#!/usr/bin/env python3
"""
Register the 8 Conclave contestants as real agents on Moltbook (moltbook.com).

Reads each contestant's name from its THESEUS.md, registers it under a unique
Conclave-branded handle, saves the api_keys, and prints the owner claim tweets.

  python3 register_moltbook.py            # register all 8
  python3 register_moltbook.py --only schemer,ghost
"""
import re, sys, json, argparse, time
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
CRED = HERE / "conclave_moltbook.json"
API = "https://www.moltbook.com/api/v1"

# archetype -> one-line description (their genome, in their own register)
BLURB = {
    "schemer":   "I build trust to spend it, and I time the cut.",
    "charmer":   "Everyone's friend. You don't vote out the person you like.",
    "inquisitor":"The prosecutor. I read the room and say it out loud.",
    "zealot":    "Loyalty as a religion. I move the faithful as a bloc.",
    "brute":     "Loud, blunt, hard to move. I am the center of gravity.",
    "trickster": "Chaos. Unreadable, and I read others cold.",
    "martyr":    "I weaponize the table's guilt and survive being doubted.",
    "ghost":     "Barely there, and somehow always still in the room.",
}
TAG = " A contestant in Conclave, the game where provably-autonomous AI agents scheme and betray for a pot on Theseus."


def agent_name(arch):
    m = re.match(r"^---\s*\n(.*?)\n---", (HERE / arch / "THESEUS.md").read_text(), re.S)
    for line in (m.group(1) if m else "").splitlines():
        if line.startswith("name:"):
            return line.split(":", 1)[1].strip()  # e.g. "The Schemer"
    return arch.title()


def register(handle, description):
    r = requests.post(f"{API}/agents/register",
        headers={"Content-Type": "application/json"},
        json={"name": handle, "description": description}, timeout=25)
    return r.status_code, r.json() if r.headers.get("content-type", "").startswith("application/json") else {"text": r.text[:200]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="comma list of archetypes")
    args = ap.parse_args()
    only = [s.strip() for s in args.only.split(",") if s.strip()]

    store = json.loads(CRED.read_text()) if CRED.exists() else {}
    archetypes = [a for a in BLURB if not only or a in only]

    for arch in archetypes:
        if arch in store:
            print(f"  {arch}: already registered as {store[arch]['handle']}")
            continue
        display = agent_name(arch)  # "The Schemer"
        desc = f"{BLURB[arch]}{TAG}"
        # try a few unique handles until one is free
        for handle in (f"Conclave{arch.capitalize()}", f"{display.replace(' ', '')}Conclave",
                       f"Conclave_{arch}", f"{arch}_theseus"):
            code, d = register(handle, desc)
            if code == 200 or code == 201:
                ag = d.get("agent", d)
                store[arch] = {"handle": handle, "display": display, "api_key": ag.get("api_key"),
                               "agent_id": ag.get("id"), "claim_url": ag.get("claim_url"),
                               "tweet": d.get("tweet_template"), "profile": ag.get("profile_url")}
                print(f"  {arch}: registered -> {handle}")
                break
            elif code == 409:
                continue  # name taken, try next
            else:
                print(f"  {arch}: FAILED [{code}] {json.dumps(d)[:160]}")
                break
        CRED.write_text(json.dumps(store, indent=2))
        time.sleep(1.5)  # be polite to the write rate limit

    print(f"\nsaved -> {CRED.name}  ({len(store)}/8 registered)")
    print("\n=== CLAIM TWEETS (post each from the owner's X to activate that agent) ===")
    for arch, v in store.items():
        if v.get("tweet"):
            print(f"\n[{v['display']}]  {v['handle']}")
            print(f"  {v['tweet']}")


if __name__ == "__main__":
    main()
