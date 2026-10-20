"""Entry point.

  python main.py --login   # one-time: prints a StringSession to store as TG_SESSION
  python main.py --once    # single sync, then exit
  python main.py           # scheduled loop (00/06/12/18 Chisinau)
"""
import argparse
import asyncio
import logging
import os
import sys

from telethon import TelegramClient
from telethon.sessions import StringSession

from tg.schedule import main_loop


async def login() -> None:
    client = TelegramClient(StringSession(), int(os.environ["TG_API_ID"]), os.environ["TG_API_HASH"])
    await client.start()
    print("\nTG_SESSION=" + client.session.save() + "\n")
    print("Store this value in Railway variables as TG_SESSION. Never commit it.")
    await client.disconnect()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", stream=sys.stdout)
    ap = argparse.ArgumentParser()
    ap.add_argument("--login", action="store_true")
    ap.add_argument("--once", action="store_true")
    args = ap.parse_args()
    if args.login:
        asyncio.run(login())
    else:
        asyncio.run(main_loop(once=args.once))
