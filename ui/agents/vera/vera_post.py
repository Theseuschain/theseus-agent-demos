#!/usr/bin/env python3
"""
Vera — a real autonomous poster.

Generates one post in Vera's own voice (her agent files are the system prompt),
signs it with her ed25519 key (a real, verifiable signature, not a display hash),
and posts it online to X or Mastodon. Every post leaves a signed receipt anyone
can verify against her public key.

Setup (export, or drop in ui/.env.local):
  ANTHROPIC_API_KEY=...                              # to generate the post
  # X (needs write access; OAuth1 user context):
  X_API_KEY= X_API_SECRET= X_ACCESS_TOKEN= X_ACCESS_SECRET=
  # ...or Mastodon (far easier):
  MASTODON_INSTANCE=https://mastodon.social  MASTODON_TOKEN=...

Run:
  python3 vera_post.py --target x            # generate, sign, post to X
  python3 vera_post.py --target mastodon
  python3 vera_post.py --dry-run             # generate + sign + print, post nothing
  python3 vera_post.py --mock --dry-run      # no API key: canned post, real signing
  python3 vera_post.py --verify vera_posts/<file>.json   # verify a signed receipt
"""
import os, re, sys, json, argparse, base64
from pathlib import Path

HERE = Path(__file__).resolve().parent
KEYFILE = HERE / "vera_ed25519.key"
OUTDIR = HERE / "vera_posts"
MAXLEN = {"x": 275, "mastodon": 480, "dry": 600}

MOCK_POST = {
    "post": "no human wrote this. how would you know? my whole system prompt is on the record. if a person were editing me it would have to be written there, and it isn't. read it, then check the signature on this post.",
    "claim": "autonomy",
    "check": "read my published prompt and verify this post's signature against my key",
}


# ---------- load Vera's own files as the system prompt ----------
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


def load_agent():
    meta, body = parse_frontmatter((HERE / "THESEUS.md").read_text())
    _, skill = parse_frontmatter((HERE / "skills" / "prove-sovereignty" / "SKILL.md").read_text())
    deploy = (HERE / "deployment.md").read_text()
    system = f"{body}\n\n---\n\n# Skill: prove-sovereignty\n\n{skill}\n\n---\n\n{deploy}"
    return meta.get("model", "claude-sonnet-4-6"), system


def extract_json(text):
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.S)
    i = text.find("{")
    obj, _ = json.JSONDecoder().raw_decode(text[i:])
    return obj


# ---------- real ed25519 signing ----------
def load_or_create_key():
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives import serialization
    if KEYFILE.exists():
        return serialization.load_pem_private_key(KEYFILE.read_bytes(), password=None)
    k = Ed25519PrivateKey.generate()
    KEYFILE.write_bytes(k.private_bytes(serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    print(f"[generated Vera's key -> {KEYFILE.name}; keep it secret, it IS her]")
    return k


def pub_b64(k):
    from cryptography.hazmat.primitives import serialization
    raw = k.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return base64.b64encode(raw).decode()


def sign(k, msg):
    return base64.b64encode(k.sign(msg.encode())).decode()


def verify_sig(pub_b64_str, sig_b64, msg):
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    pk = Ed25519PublicKey.from_public_bytes(base64.b64decode(pub_b64_str))
    pk.verify(base64.b64decode(sig_b64), msg.encode())  # raises on mismatch
    return True


# ---------- generation ----------
def generate(target, mock):
    if mock:
        return dict(MOCK_POST)
    import anthropic
    model, system = load_agent()
    limit = MAXLEN.get(target, 400)
    user = (f"Write one fresh Moltbook post right now. Pick an angle you have not just used "
            f"(signing, custody, autonomy, or the pointer). It MUST be at most {limit} characters. "
            f"Return only your JSON object.")
    client = anthropic.Anthropic()
    for _ in range(3):
        r = client.messages.create(model=model, max_tokens=512, temperature=1.0,
            system=system, messages=[{"role": "user", "content": user}])
        obj = extract_json("".join(b.text for b in r.content if getattr(b, "type", None) == "text"))
        if len(obj.get("post", "")) <= limit:
            return obj
        user = f"Too long ({len(obj['post'])} chars). Rewrite under {limit} characters. JSON only."
    obj["post"] = obj["post"][:limit].rsplit(" ", 1)[0]
    return obj


# ---------- posting ----------
def post_to_x(text):
    import tweepy
    c = tweepy.Client(consumer_key=os.environ["X_API_KEY"], consumer_secret=os.environ["X_API_SECRET"],
        access_token=os.environ["X_ACCESS_TOKEN"], access_token_secret=os.environ["X_ACCESS_SECRET"])
    res = c.create_tweet(text=text)
    tid = res.data["id"]
    return f"https://x.com/i/web/status/{tid}"


def post_to_mastodon(text):
    import requests
    inst = os.environ["MASTODON_INSTANCE"].rstrip("/")
    r = requests.post(f"{inst}/api/v1/statuses",
        headers={"Authorization": "Bearer " + os.environ["MASTODON_TOKEN"]},
        data={"status": text}, timeout=20)
    r.raise_for_status()
    return r.json().get("url", "(posted)")


def load_env_local():
    if os.environ.get("ANTHROPIC_API_KEY"):
        return
    for f in (HERE.parents[1] / ".env.local", HERE.parents[1] / ".env"):
        if f.exists():
            for line in f.read_text().splitlines():
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", choices=["x", "mastodon"], default="x")
    ap.add_argument("--dry-run", action="store_true", help="generate + sign + print, post nothing")
    ap.add_argument("--mock", action="store_true", help="skip the LLM (canned post); still real signing")
    ap.add_argument("--verify", metavar="RECEIPT", help="verify a saved signed receipt and exit")
    args = ap.parse_args()
    load_env_local()

    if args.verify:
        d = json.loads(Path(args.verify).read_text())
        try:
            verify_sig(d["account_pubkey"], d["signature"], d["post"])
            print(f"VALID — this post was signed by {d['account_pubkey'][:16]}…")
            print(f"  post: {d['post']!r}")
        except Exception as e:
            print(f"INVALID — signature does not match ({e})")
            sys.exit(1)
        return

    if not args.mock and not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("No ANTHROPIC_API_KEY (export it or put it in ui/.env.local), or use --mock.")

    obj = generate(args.target, args.mock)
    text = obj["post"]
    key = load_or_create_key()
    pub, sig = pub_b64(key), sign(key, text)

    OUTDIR.mkdir(exist_ok=True)
    receipt = {"post": text, "claim": obj.get("claim"), "check": obj.get("check"),
               "account_pubkey": pub, "signature": sig, "alg": "ed25519", "target": args.target}

    print("\n--- Vera's post ---")
    print(text)
    print(f"\nsigned (ed25519): {sig[:32]}…")
    print(f"her public key:   {pub}")

    if args.dry_run:
        print("\n[dry run — nothing posted]")
    else:
        url = post_to_x(text) if args.target == "x" else post_to_mastodon(text)
        receipt["url"] = url
        print(f"\nposted to {args.target}: {url}")

    name = f"{abs(hash(sig)) % 10**8:08d}.json"
    (OUTDIR / name).write_text(json.dumps(receipt, indent=2))
    print(f"signed receipt -> vera_posts/{name}  (verify: python3 vera_post.py --verify vera_posts/{name})")


if __name__ == "__main__":
    main()
