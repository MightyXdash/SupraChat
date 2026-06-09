#!/usr/bin/env python3
"""Terminal chat — run with: python chat.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from inference import SupraInference


def main() -> None:
    print("[supra] initializing inference engine...")
    engine = SupraInference()
    print("[supra] ready. Type 'exit' or Ctrl+C to quit.\n")

    history: list[dict[str, str]] = []

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n[supra] bye.")
            break

        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit"):
            print("[supra] bye.")
            break

        history.append({"role": "user", "content": user_input})
        response = engine.generate(history=history)
        history.append({"role": "assistant", "content": response})

        print(f"Supra: {response}\n")


if __name__ == "__main__":
    main()
