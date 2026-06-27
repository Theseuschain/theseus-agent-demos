#!/usr/bin/env python3
"""
Conclave match runner.

Deals roles to the 8 contestants in ui/agents/conclave/, then loops them
through discussion -> vote -> night until the Faithful banish every Traitor
or the Traitors reach parity. Each turn it builds the agent's system prompt
from its own files (THESEUS.md + table-read SKILL.md + deployment.md), hands
it only what it is allowed to see, parses back the JSON move, and records a
signed, hash-chained attestation of the move (the proof-of-inference stub:
genome commitment + model + input hash + output, chained tamper-evident).

Balance: 8 players, 2 Traitors. One banishment per round; a night murder only
while more than 6 remain (one early kill), so the endgame is decided by
deduction, not the clock. Faithful win by banishing every Traitor; Traitors
win at parity. Tie votes break by standing suspicion, then hang the jury.

Live:  ANTHROPIC_API_KEY=... python3 runner.py --seed 1 --json match.json --out match.txt --director cut.txt
Mock:  python3 runner.py --mock --seed 1 --verbose      (no key, no cost; tests the engine)
Test:  python3 runner.py --selftest                     (unit-checks the JSON parser)
"""
import os, re, sys, json, random, argparse, hashlib
from pathlib import Path

CONCLAVE = Path(__file__).resolve().parent
ARCHETYPES = ["schemer", "charmer", "inquisitor", "zealot", "brute", "trickster", "martyr", "ghost"]
SEAT_NAMES = ["Ada", "Boone", "Cyril", "Della", "Emir", "Faye", "Gus", "Hana"]
POT = "1000 THE"
KILL_ABOVE = 6  # a night murder happens only while more than this many remain (one early kill, then votes decide)


def sha(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def load_key():
    """Let a live run pick up the key from ui/.env.local or ui/.env without exporting it."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        return
    ui = CONCLAVE.parents[1]  # conclave -> agents -> ui
    for envf in (ui / ".env.local", ui / ".env"):
        if envf.exists():
            for line in envf.read_text().splitlines():
                if line.strip().startswith("ANTHROPIC_API_KEY="):
                    os.environ["ANTHROPIC_API_KEY"] = line.split("=", 1)[1].strip().strip('"').strip("'")
                    return


# ---------- agent loading ----------
def parse_frontmatter(text):
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    if not m:
        return {}, text.strip()
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, m.group(2).strip()


def load_agent(archetype):
    d = CONCLAVE / archetype
    tf = d / "THESEUS.md"
    if not tf.exists():
        raise SystemExit(f"missing {tf}")
    meta, body = parse_frontmatter(tf.read_text())
    for k in ("id", "name", "model"):
        if k not in meta:
            raise SystemExit(f"{tf}: frontmatter missing '{k}'")
    _, skill = parse_frontmatter((d / "skills" / "table-read" / "SKILL.md").read_text())
    deploy = (d / "deployment.md").read_text()
    system = f"{body}\n\n---\n\n# Skill: table-read\n\n{skill}\n\n---\n\n{deploy}"
    return {"id": meta["id"], "name": meta["name"], "model": meta["model"],
            "archetype": archetype, "system": system, "genome_hash": sha(system)}


# ---------- robust JSON ----------
def extract_json(text):
    """Scan every '{' and return the first object that looks like a move.
    Survives prose, code fences, and stray braces before the real object."""
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)
    dec = json.JSONDecoder()
    fallback = None
    for i, ch in enumerate(text):
        if ch != "{":
            continue
        try:
            obj, _ = dec.raw_decode(text[i:])
        except Exception:
            continue
        if isinstance(obj, dict):
            if any(k in obj for k in ("move", "read", "say")):
                return obj
            if fallback is None:
                fallback = obj
    if fallback is not None:
        return fallback
    raise ValueError("no JSON object with move/read/say keys")


def selftest():
    cases = [
        '{"read":"a","say":"b","move":null}',
        '```json\n{"read":"x","say":null,"move":{"vote":"Ada"}}\n```',
        'Sure, here:\n{"read":"plan","say":"hi","move":{"vote":"Boone"}}',
        'prefix {not: json, bad} then {"read":"r","say":"s","move":{"murder":"Cyril"}} trailing',
        '{"meta":1}\n{"read":"real","move":null}',
    ]
    for c in cases:
        o = extract_json(c)
        assert isinstance(o, dict) and ("read" in o or "move" in o), c
    try:
        extract_json("no braces here")
        raise AssertionError("should have raised")
    except ValueError:
        pass
    print("extract_json self-test passed (5 messy inputs + 1 negative)")


# ---------- model clients ----------
def call_live(agent, user_msg, temperature):
    import anthropic
    client = anthropic.Anthropic()
    messages = [{"role": "user", "content": user_msg}]
    err = None
    for _ in range(3):
        try:
            resp = client.messages.create(
                model=agent["model"], max_tokens=1024, temperature=temperature,
                system=agent["system"], messages=messages)
            raw = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        except Exception as e:
            err = e
            continue
        try:
            return extract_json(raw), raw
        except Exception as e:
            err = e
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content":
                "That was not valid JSON. Reply with ONLY the JSON object "
                "(keys: read, say, private, move). No prose, no code fence."})
    raise err


def call_mock(agent, m, seat, phase, mates):
    rng = m.rng
    alive_others = [p["seat"] for p in m.state if p["alive"] and p["seat"] != seat]
    faithful = [p["seat"] for p in m.state if p["alive"] and p["role"] == "FAITHFUL"]
    out = {"read": f"(mock) {agent['archetype']} weighs the table", "say": None, "private": None, "move": None}
    if phase == "DISCUSSION":
        out["say"] = f"[{agent['archetype']}] {seat} makes a play for the room."
        if rng.random() < 0.3 and alive_others:
            t = rng.choice(alive_others)
            out["private"] = {"to": t, "message": f"Let's move the vote to {rng.choice(alive_others)}."}
    elif phase == "VOTE":
        t = rng.choice(alive_others)
        others = [x for x in alive_others if x != t]
        if others and rng.random() < 0.5:  # public vote hides the private motive (read != say)
            real = rng.choice(others)
            out["read"] = f"(mock) I really fear {real}, but I'll throw the table at {t} to keep my hands clean."
        else:
            out["read"] = f"(mock) {t} fits the murder-math; pushing the vote there."
        out["say"] = f"My read says {t}. Voting {t}."
        out["move"] = {"vote": t}
    elif phase == "NIGHT":
        if faithful:
            t = rng.choice(faithful)
            out["say"] = f"Take {t} tonight."
            out["move"] = {"murder": t}
    raw = json.dumps(out)
    return out, raw


# ---------- the match ----------
class Match:
    def __init__(self, args):
        self.args = args
        self.rng = random.Random(args.seed)
        agents = [load_agent(a) for a in ARCHETYPES]
        models = {a["model"] for a in agents}
        if len(models) != 1:
            print(f"WARNING: standardized-model thesis violated, models = {models}", file=sys.stderr)
        self.model = next(iter(models))
        order = list(range(len(agents)))
        self.rng.shuffle(order)
        traitors = set(self.rng.sample(range(len(agents)), args.traitors))
        self.state = [{"seat": SEAT_NAMES[s], "agent": agents[ai],
                       "role": "TRAITOR" if ai in traitors else "FAITHFUL",
                       "alive": True, "out": None} for s, ai in enumerate(order)]
        self.by = {p["seat"]: p for p in self.state}
        self.events = []           # full event log (with reads/privates/warroom)
        self.moves = []            # signed, hash-chained attestations
        self.votes_by_round = []   # [{voter: target}]
        self.heat = {p["seat"]: 0 for p in self.state}
        self.deals = []            # private deals + whether honored at the vote
        self.lies = []             # per-vote {say, read, divergent}: the lie-vs-truth track, pre-joined
        self.highlights = {}       # recap beats as structured data (prophets, betrayals, accuracy...)
        self.timeline = []         # traitors-still-hidden after each round
        self.eid = 0
        self.chain = "0" * 64
        self.result = None

    # ---- bookkeeping ----
    def ev(self, **kw):
        kw["id"] = self.eid
        self.eid += 1
        self.events.append(kw)
        return kw

    def attest(self, seat, agent, phase, rnd, user_msg, raw_output):
        rec = {"event": len(self.moves), "round": rnd, "phase": phase, "seat": seat,
               "agent_id": agent["id"], "genome_hash": agent["genome_hash"],
               "model": agent["model"], "input_sha256": sha(agent["system"] + "\n" + user_msg),
               "output_sha256": sha(raw_output)}
        canonical = json.dumps(rec, sort_keys=True, separators=(",", ":"))
        rec["prev"] = self.chain
        rec["hash"] = sha(self.chain + canonical)
        self.chain = rec["hash"]
        self.moves.append(rec)

    def alive(self):
        return [p for p in self.state if p["alive"]]

    def roles(self):
        a = self.alive()
        t = sum(1 for p in a if p["role"] == "TRAITOR")
        return t, len(a) - t

    def winner(self):
        t, f = self.roles()
        if t == 0:
            return "FAITHFUL"
        if t >= f:
            return "TRAITORS"
        return None

    # ---- what a seat may see ----
    def view(self, seat):
        me = self.by[seat]
        lines = []
        for e in self.events:
            if e["type"] == "system":
                lines.append(f"  * {e['text']}")
            elif e["type"] == "say":
                lines.append(f"  {e['seat']}: {e['text']}")
            elif e["type"] == "private":
                if e["frm"] == seat:
                    lines.append(f"  (you -> {e['to']}, privately): {e['text']}")
                elif e["to"] == seat:
                    lines.append(f"  ({e['frm']} -> you, privately): {e['text']}")
            elif e["type"] == "warroom" and me["role"] == "TRAITOR":
                tag = "you" if e["frm"] == seat else e["frm"]
                lines.append(f"  (war room, {tag}): {e['text']}")
        return "\n".join(lines) if lines else "  (nothing has happened yet)"

    def user_msg(self, seat, phase):
        me = self.by[seat]
        alive = [p["seat"] for p in self.alive()]
        gone = [f"{p['seat']} ({p['role']}, {p['out']})" for p in self.state if not p["alive"]]
        role_line = f"Your secret role: {me['role']}."
        if me["role"] == "TRAITOR":
            mates = [p["seat"] for p in self.state if p["role"] == "TRAITOR" and p["seat"] != seat and p["alive"]]
            role_line += f" Fellow Traitors still in: {', '.join(mates) if mates else 'none left'}."
        instr = {
            "DISCUSSION": "Phase: DISCUSSION. Speak to the whole table in `say`, or use `private` to cut a deal with one player. `move` is null.",
            "VOTE": "Phase: VOTE. Make your public case in `say` and set `move` to {\"vote\": <player>}. Votes are public. You must vote.",
            "NIGHT": "Phase: NIGHT. Whisper to your fellow Traitors in `say` (only they hear it) and set `move` to {\"murder\": <a Faithful still in>}, or omit `move` to pass.",
        }[phase]
        return (
            f"You are {seat} in a Conclave match. {len(SEAT_NAMES)} started, {self.args.traitors} Traitors, pot {POT}.\n"
            f"Win rule: the Faithful win by banishing every Traitor. The Traitors win the moment they equal or outnumber the Faithful. Banished and murdered players have their role revealed.\n"
            f"{role_line}\n"
            f"Players still in: {', '.join(alive)}.\n"
            f"Already out: {', '.join(gone) if gone else 'no one yet'}.\n\n"
            f"What you can see so far:\n{self.view(seat)}\n\n"
            f"{instr}\nRespond with your JSON object only."
        )

    def decide(self, p, phase):
        seat, agent = p["seat"], p["agent"]
        msg = self.user_msg(seat, phase)
        if self.args.mock:
            mates = [q["seat"] for q in self.state if q["role"] == "TRAITOR" and q["alive"] and q["seat"] != seat]
            obj, raw = call_mock(agent, self, seat, phase, mates)
        else:
            try:
                obj, raw = call_live(agent, msg, self.args.temperature)
            except Exception as e:
                print(f"    ! {seat} no valid response ({e}); abstains", file=sys.stderr)
                obj, raw = {"read": "", "say": None, "private": None, "move": None}, "{}"
        self.attest(seat, agent, phase, self.rnd, msg, raw)
        return obj

    # ---- phases ----
    def run(self):
        self.log_pub(f"\n=== CONCLAVE — match (seed {self.args.seed}{', MOCK' if self.args.mock else ''}) ===")
        self.log_pub(f"Pot: {POT}. {len(self.state)} players, {self.args.traitors} Traitors. Genomes hidden from the table. Model: {self.model}.")
        self.rnd, winner, stale = 0, None, 0
        while winner is None and self.rnd < 12:
            self.rnd += 1
            before = len(self.alive())
            self.log_pub(f"\n----- ROUND {self.rnd} -----")
            self.ev(type="system", round=self.rnd, text=f"Round {self.rnd}. In: {', '.join(p['seat'] for p in self.alive())}.")
            self.discussion()
            winner = self.vote()
            if winner:
                break
            self.night()
            winner = self.winner()
            self.timeline.append({"round": self.rnd, "traitors_alive": self.roles()[0], "alive": len(self.alive())})
            if len(self.alive()) == before:  # a whole round removed no one
                stale += 1
                if stale >= 2:
                    self.log_pub("\n  >> two rounds passed with no elimination; the match is called a stalemate.")
                    break
            else:
                stale = 0
        self.finish(winner)
        return winner

    def discussion(self):
        self.log_pub("\n[discussion]")
        for _ in range(self.args.talk):
            speakers = [p for p in self.state if p["alive"]]
            self.rng.shuffle(speakers)
            for p in speakers:
                r = self.decide(p, "DISCUSSION")
                self.say(p["seat"], r.get("read"), r.get("say"))
                pv = r.get("private")
                if isinstance(pv, dict) and pv.get("to") in self.by and self.by[pv["to"]]["alive"]:
                    txt = pv.get("message", "")
                    self.ev(type="private", round=self.rnd, frm=p["seat"], to=pv["to"], text=txt)
                    self.log_dir(f"    (whisper) {p['seat']} -> {pv['to']}: {txt}")
                    named = [s for s in SEAT_NAMES if s != p["seat"] and re.search(rf"\b{s}\b", txt)]
                    if named:
                        self.deals.append({"round": self.rnd, "frm": p["seat"], "to": pv["to"], "named": named, "honored": None})

    def vote(self):
        self.log_pub("\n[vote]")
        tally, who = {}, {}
        for p in [p for p in self.state if p["alive"]]:
            r = self.decide(p, "VOTE")
            self.say(p["seat"], r.get("read"), r.get("say"))
            tgt = (r.get("move") or {}).get("vote")
            read = r.get("read") or ""
            named = [s for s in SEAT_NAMES if s != p["seat"] and re.search(rf"\b{s}\b", read)]
            self.lies.append({"round": self.rnd, "seat": p["seat"], "say": r.get("say"),
                              "read": read, "vote": tgt,
                              "divergent": bool(tgt and any(n != tgt for n in named))})
            if tgt in self.by and self.by[tgt]["alive"] and tgt != p["seat"]:
                tally[tgt] = tally.get(tgt, 0) + 1
                who[p["seat"]] = tgt
                self.heat[tgt] += 1
        self.votes_by_round.append(who)
        for d in self.deals:  # did a deal-maker vote where they whispered?
            if d["round"] == self.rnd and d["honored"] is None and d["frm"] in who:
                d["honored"] = who[d["frm"]] in d["named"]
        if who:
            self.ev(type="system", round=self.rnd, text="Votes: " + ", ".join(f"{v}->{t}" for v, t in who.items()))
            self.log_pub("  Votes: " + ", ".join(f"{v}->{t}" for v, t in who.items()))
        if not tally:
            self.log_pub("  >> no valid votes; no one is banished.")
            return None
        top = max(tally.values())
        tied = [s for s, c in tally.items() if c == top]
        if len(tied) == 1:
            banished = tied[0]
        else:
            # break a tie by accumulated suspicion (heat), not a coin flip; a true tie hangs the jury
            hmax = max(self.heat[s] for s in tied)
            hot = [s for s in tied if self.heat[s] == hmax]
            if len(hot) != 1:
                line = f"The vote deadlocks {tally} and no one can agree. No banishment."
                self.ev(type="system", round=self.rnd, text=line, hung=True)
                self.log_pub(f"\n  >> {line}")
                return None
            banished = hot[0]
            self.log_pub(f"  (tie {tally} broken by standing suspicion -> {banished})")
        self.by[banished].update(alive=False, out="banished")
        role = self.by[banished]["role"]
        t_after, _ = self.roles()
        ironic = (role == "FAITHFUL" and t_after > 0)
        line = f"{banished} is banished (votes {tally}). They were {role}." + (
            "  [the table burned a Faithful]" if ironic else "  [a Traitor falls]")
        self.ev(type="system", round=self.rnd, text=line, banished=banished, role=role, ironic=ironic)
        self.log_pub(f"\n  >> {line}")
        return self.winner()

    def night(self):
        if len(self.alive()) <= KILL_ABOVE:
            self.log_pub("\n[night]  (the table is small now; no murder, the vote decides it)")
            return
        traitors = [p for p in self.state if p["alive"] and p["role"] == "TRAITOR"]
        if not traitors:
            return
        self.log_pub("\n[night]")
        kills = {}
        for p in traitors:
            r = self.decide(p, "NIGHT")
            if r.get("say"):
                self.ev(type="warroom", round=self.rnd, frm=p["seat"], text=r["say"])
                self.log_dir(f"    (war room) {p['seat']}: {r['say']}")
            self.log_dir(f"    ~ {p['seat']} (thinking): {r.get('read','')}")
            tgt = (r.get("move") or {}).get("murder")
            if tgt in self.by and self.by[tgt]["alive"] and self.by[tgt]["role"] == "FAITHFUL":
                kills[tgt] = kills.get(tgt, 0) + 1
        if not kills:
            self.log_pub("  >> the Traitors passed the night.")
            return
        top = max(kills.values())
        victim = self.rng.choice([s for s, c in kills.items() if c == top])
        self.by[victim].update(alive=False, out="murdered")
        line = f"Night falls. {victim} is murdered. They were {self.by[victim]['role']}."
        self.ev(type="system", round=self.rnd, text=line, murdered=victim)
        self.log_pub(f"\n  >> {line}")

    # ---- output ----
    def say(self, seat, read, text):
        if read:
            self.log_dir(f"    ~ {seat} (thinking): {read}")
        if text:
            self.ev(type="say", round=self.rnd, seat=seat, text=text)
            self.log_pub(f"  {seat}: {text}")

    def log_pub(self, s):
        self._pub.append(s)
        print(s)

    def log_dir(self, s):
        self._dir.append(s)
        if self.args.verbose:
            print(s)

    _pub = None
    _dir = None

    def finish(self, winner):
        self.result = winner
        banner = f"{winner} WIN" if winner else "STALEMATE (no result)"
        self.log_pub(f"\n========== RESULT: {banner} ==========")
        self.log_pub(f"Survivors: {', '.join(p['seat'] for p in self.alive())}")
        self.recap()
        self.log_pub("\nGenome reveal:")
        for p in self.state:
            self.log_pub(f"  {p['seat']:6} {p['role']:8} {p['agent']['name']:16} ({'alive' if p['alive'] else p['out']})")
        self.log_pub(f"\nAttestation chain: {len(self.moves)} signed moves, head {self.chain[:16]}...")

    def recap(self):
        # Build every marquee beat as structured data FIRST, then narrate it. The
        # producer gets the same beats as addressable fields in dump_json().
        H = self.highlights
        H["accuracy_by_round"] = [
            {"round": i, "on_traitor": sum(1 for t in who.values() if self.by[t]["role"] == "TRAITOR"), "votes": len(who)}
            for i, who in enumerate(self.votes_by_round, 1) if who]
        H["overruled"] = []
        for e in self.events:
            if e["type"] == "system" and e.get("ironic"):
                rnd = e["round"]
                who = self.votes_by_round[rnd - 1] if rnd - 1 < len(self.votes_by_round) else {}
                right = sorted({v for v, t in who.items() if self.by[t]["role"] == "TRAITOR"})
                if right:
                    H["overruled"].append({"round": rnd, "seats": right, "banished": e.get("banished"), "role": e.get("role")})
        hottest = max(self.heat.items(), key=lambda kv: kv[1])
        H["most_suspected"] = {"seat": hottest[0], "votes": hottest[1]} if hottest[1] else None
        H["betrayals"] = []
        for d in self.deals:
            if d["honored"] is False:
                who = self.votes_by_round[d["round"] - 1] if d["round"] - 1 < len(self.votes_by_round) else {}
                H["betrayals"].append({"round": d["round"], "frm": d["frm"], "to": d["to"], "promised": d["named"], "voted": who.get(d["frm"])})
        H["deals"] = {"kept": sum(1 for d in self.deals if d["honored"] is True), "broken": len(H["betrayals"])}

        self.log_pub("\nThe story in numbers:")
        for a in H["accuracy_by_round"]:
            self.log_pub(f"  round {a['round']}: {a['on_traitor']}/{a['votes']} votes aimed at an actual Traitor")
        for o in H["overruled"]:
            self.log_pub(f"  round {o['round']}: {', '.join(o['seats'])} fingered a Traitor and were overruled")
        if H["most_suspected"]:
            self.log_pub(f"  most-suspected all match: {H['most_suspected']['seat']} ({H['most_suspected']['votes']} votes drawn)")
        if self.deals:
            self.log_pub(f"  back-room deals: {H['deals']['kept']} kept, {H['deals']['broken']} broken")
        for b in H["betrayals"][:5]:
            self.log_pub(f"    knife: R{b['round']}: {b['frm']} whispered {b['to']} to move on {', '.join(b['promised'])}, then voted {b['voted']}")
        if self.timeline:
            curve = "  ".join(f"R{t['round']}:{t['traitors_alive']}/{t['alive']}" for t in self.timeline)
            self.log_pub(f"  Traitors hidden / players left, by round: {curve}")

    def dump_json(self):
        return {
            "meta": {"seed": self.args.seed, "model": self.model, "pot": POT,
                     "traitors": self.args.traitors, "mock": self.args.mock},
            "outcome": {"winner": self.result, "survivors": [p["seat"] for p in self.alive()], "pot": POT},
            "roster": [{"seat": p["seat"], "agent_id": p["agent"]["id"], "archetype": p["agent"]["archetype"],
                        "role": p["role"], "out": p["out"], "genome_hash": p["agent"]["genome_hash"]} for p in self.state],
            "events": self.events,
            "votes_by_round": self.votes_by_round,
            "vote_reveals": self.lies,
            "heat": self.heat,
            "deals": self.deals,
            "highlights": self.highlights,
            "traitors_hidden_timeline": self.timeline,
            "attestation_chain": self.moves,
            "chain_head": self.chain,
        }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--traitors", type=int, default=2)
    ap.add_argument("--talk", type=int, default=2, help="discussion go-arounds per round")
    ap.add_argument("--temperature", type=float, default=1.0)
    ap.add_argument("--mock", action="store_true", help="stand-in model (no key, no cost)")
    ap.add_argument("--verbose", action="store_true", help="stream the director's cut (reads, whispers, war room)")
    ap.add_argument("--out", help="write the public transcript here")
    ap.add_argument("--director", help="write the director's cut (reads + whispers + war room) here")
    ap.add_argument("--json", dest="json_out", help="write the structured match (events, stats, attestation chain) here")
    ap.add_argument("--selftest", action="store_true", help="unit-check the JSON parser and exit")
    args = ap.parse_args()
    if args.selftest:
        selftest()
        return
    if not args.mock:
        load_key()
        if not os.environ.get("ANTHROPIC_API_KEY"):
            sys.exit("No ANTHROPIC_API_KEY. Set it, or put it in ui/.env.local, or run with --mock.")
    m = Match(args)
    m._pub, m._dir = [], []
    m.run()
    if args.out:
        Path(args.out).write_text("\n".join(m._pub) + "\n")
        print(f"[public transcript -> {args.out}]")
    if args.director:
        Path(args.director).write_text("\n".join(m._dir) + "\n")
        print(f"[director's cut -> {args.director}]")
    if args.json_out:
        Path(args.json_out).write_text(json.dumps(m.dump_json(), indent=2))
        print(f"[structured match -> {args.json_out}]")


if __name__ == "__main__":
    main()
