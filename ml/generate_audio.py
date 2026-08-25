"""Generate the pre-recorded voice-guide clips for every fixed prompt.

Reads audio/prompts.json, synthesizes one clip per prompt/token, writes them
to public/audio/, and produces public/audio/manifest.json keyed by the same
normalized text the app's VoiceGuide uses (src/core/voiceGuide.ts clipKey).
The app plays a clip when one exists and falls back to speechSynthesis for
anything missing, so partial generation is safe.

Engines:
  Piper (offline, free, natural neural voice):
    pip install piper-tts
    # download a voice, e.g. en_US-lessac-medium, from
    # https://huggingface.co/rhasspy/piper-voices (both .onnx and .onnx.json)
    python3 ml/generate_audio.py --engine piper --model en_US-lessac-medium.onnx

  ElevenLabs (paid, premium voices):
    ELEVENLABS_API_KEY=... python3 ml/generate_audio.py --engine elevenlabs \
        --voice 21m00Tcm4TlvDq8ikWAM

Note: this session's build environment cannot reach huggingface.co or
api.elevenlabs.io (network policy), so run this once on your own machine and
commit the generated public/audio/ directory.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "audio")


def clip_key(text: str) -> str:
    """Must match clipKey() in src/core/voiceGuide.ts."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def load_utterances() -> list[str]:
    with open(os.path.join(ROOT, "audio", "prompts.json")) as f:
        spec = json.load(f)
    tokens = spec.get("tokens", {})
    seq = (
        tokens.get("letters", [])
        + tokens.get("digits", [])
        + tokens.get("words", [])
    )
    return spec["prompts"] + seq


def synth_piper(text: str, out_path: str, model: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "piper", "-m", model, "-f", out_path, "--", text],
        check=True,
        capture_output=True,
    )


def synth_elevenlabs(text: str, out_path: str, voice: str) -> None:
    import urllib.request

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise SystemExit("set ELEVENLABS_API_KEY")
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
        data=json.dumps(
            {
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": 0.6, "similarity_boost": 0.8},
            }
        ).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp, open(out_path, "wb") as f:
        f.write(resp.read())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", choices=["piper", "elevenlabs"], required=True)
    parser.add_argument("--model", help="piper: path to voice .onnx")
    parser.add_argument("--voice", help="elevenlabs: voice id")
    args = parser.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    manifest: dict[str, str] = {}
    utterances = load_utterances()
    ext = "wav" if args.engine == "piper" else "mp3"

    for text in utterances:
        key = clip_key(text)
        name = f"{re.sub(r'[^a-z0-9]+', '-', key)[:40].strip('-')}-{hashlib.sha1(key.encode()).hexdigest()[:8]}.{ext}"
        out_path = os.path.join(OUT_DIR, name)
        if not os.path.exists(out_path):
            if args.engine == "piper":
                if not args.model:
                    raise SystemExit("--model required for piper")
                synth_piper(text, out_path, args.model)
            else:
                if not args.voice:
                    raise SystemExit("--voice required for elevenlabs")
                synth_elevenlabs(text, out_path, args.voice)
            print(f"generated {name}")
        manifest[key] = name

    with open(os.path.join(OUT_DIR, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
    print(f"wrote manifest with {len(manifest)} clips")


if __name__ == "__main__":
    main()
