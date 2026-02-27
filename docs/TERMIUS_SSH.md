# Connect with Termius (SSH from your phone)

Use this to run Meridian session/backtest from your phone via SSH.

## 1. Enable SSH on your Mac

- **System Settings** → **General** → **Sharing** → turn **Remote Login** ON.
- Allow access for your user (or "All users" if you prefer).

## 2. Get your connection details

From your Mac, in the repo root run:

```bash
./scripts/termius-info.sh
```

It prints **Host**, **User**, **Port**, and the exact **cd** path to use after login. Use those values in Termius.

## 3. Add the host in Termius

1. Open **Termius** on your phone.
2. **Hosts** → **+** (Add host).
3. Fill in:
   - **Address**: the IP from the script (e.g. `192.168.1.42`). Your phone and Mac must be on the **same Wi‑Fi**.
   - **Port**: `22`
   - **Username**: the user from the script (e.g. `chasehopkins`).
   - **Password**: your Mac login password (or add a key — see below).
4. Save. Tap the host to connect.

## 4. First time after login

```bash
cd /Users/chasehopkins/Documents/Projects/Cursor/trading/execution-risk-research-stack
make session
# or
PYTHONPATH=packages/engine/src packages/engine/.venv/bin/python -m engine.scripts.session_cli QQQ SPY
# backtest:
PYTHONPATH=packages/engine/src packages/engine/.venv/bin/python -m engine.scripts.backtest_cli --out apps/web/public/research/latest
```

If you’ve run `make install` on this machine, the venv and commands are already there.

## 5. (Optional) Use an SSH key instead of password

On your Mac:

```bash
# If you don’t have a key yet
ssh-keygen -t ed25519 -C "termius" -f ~/.ssh/termius_ed25519 -N ""
cat ~/.ssh/termius_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

In Termius, add the host, then edit it → **Key** → **Import** or **Generate** and copy the **public** key into your Mac’s `~/.ssh/authorized_keys`, or use Termius’s key and add that public key to `authorized_keys`.

## 6. Same Wi‑Fi required

Your phone must be on the same local network as your Mac. The script’s IP is your Mac’s LAN address (e.g. Wi‑Fi). If the IP changes (e.g. after reboot), run `./scripts/termius-info.sh` again and update the host in Termius.

## 7. From another network (e.g. cellular)

To connect when you’re not on the same Wi‑Fi you need one of:

- **Tailscale** (or similar): install on Mac and phone, use the Mac’s Tailscale IP in Termius.
- **Port forwarding** on your router: forward port 22 to your Mac’s LAN IP (less secure; prefer Tailscale).
- **Cloud VM**: run the repo on a VPS (e.g. DigitalOcean, AWS), SSH to that from Termius, and run the same commands there.
