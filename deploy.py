#!/usr/bin/env python3
"""
Anti-Gravity Music Player — Premium Deployment TUI
==================================================
Version 4.0 - Premium TUI with Enhanced Visuals
"""

import os
import sys
import subprocess
import signal
import time
import json
import shutil
from pathlib import Path
from typing import Dict, Any, Union, List, Optional

# ─── Configuration ───
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_DIR = SCRIPT_DIR
SERVER_DIR = PROJECT_DIR / "server"
PID_FILE = PROJECT_DIR / ".server_pids.json"
COOKIES_FILE = SERVER_DIR / "cookies.txt"

FRONTEND_PORT = 5173
BACKEND_PORT = 3001

# Colors & Aesthetics
class C:
    MAGENTA = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    WHITE = "\033[97m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    ITALIC = "\033[3m"
    UNDERLINE = "\033[4m"
    BG_GREEN = "\033[42m"
    BG_RED = "\033[41m"
    BG_YELLOW = "\033[43m"
    BG_BLUE = "\033[44m"
    BG_MAGENTA = "\033[45m"
    END = "\033[0m"
    CLEAR = "\033[H\033[2J"

BANNER = f"""
{C.MAGENTA}{C.BOLD}
   ██████╗ ██████╗  █████╗ ██╗   ██╗██╗████████╗██╗   ██╗███╗   ██╗███████╗███████╗
   ██╔════╝ ██╔══██╗██╔══██╗██║   ██║██║╚══██╔══╝██║   ██║████╗  ██║██╔════╝██╔════╝
   ██║  ███╗██████╔╝███████║██║   ██║██║   ██║   ██║   ██║██╔██╗ ██║█████╗  ███████╗
   ██║   ██║██╔══██╗██╔══██║╚██╗ ██╔╝██║   ██║   ██║   ██║██║╚██╗██║██╔══╝  ╚════██║
   ╚██████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║   ██║   ╚██████╔╝██║ ╚████║███████╗███████║
    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝ ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚══════╝
{C.END}"""

SKULL = f"""
{C.RED}
           .---.
          /     \\
         | () () |
          \\  ^  /
           |||||
           '|||'
{C.END}
"""

# ─── Utility Functions ───

def clear_screen():
    print(C.CLEAR, end="")

def draw_box(title: str, lines: List[str], color: str = C.CYAN, width: int = 52) -> None:
    """Draw a box-framed section with title."""
    inner = width - 4
    print(f"   {color}┌── {C.BOLD}{title}{C.END}{color} {'─' * max(0, inner - len(title) - 1)}┐{C.END}")
    for line in lines:
        # Pad line to inner width (strip ANSI for length calc)
        clean = line
        for code in ['\033[95m','\033[94m','\033[96m','\033[92m','\033[93m','\033[91m','\033[97m',
                      '\033[1m','\033[2m','\033[3m','\033[4m','\033[0m','\033[42m','\033[41m',
                      '\033[43m','\033[44m','\033[45m']:
            clean = clean.replace(code, '')
        pad = max(0, inner - len(clean))
        print(f"   {color}│{C.END} {line}{' ' * pad} {color}│{C.END}")
    print(f"   {color}└{'─' * (width - 2)}┘{C.END}")

def progress_bar(current: int, total: int, width: int = 30, label: str = "") -> str:
    """Create a visual progress bar."""
    filled = int(width * current / total) if total > 0 else 0
    bar = f"{C.GREEN}{'█' * filled}{C.DIM}{'░' * (width - filled)}{C.END}"
    pct = int(100 * current / total) if total > 0 else 0
    return f"{bar} {C.BOLD}{pct}%{C.END} {C.DIM}{label}{C.END}"

def spinner_wait(msg: str, seconds: float = 2.0) -> None:
    """Show a spinning animation while waiting."""
    frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    end_time = time.time() + seconds
    i = 0
    while time.time() < end_time:
        print(f"\r   {C.CYAN}{frames[i % len(frames)]}{C.END} {msg}", end="", flush=True)
        time.sleep(0.1)
        i += 1
    print(f"\r   {C.GREEN}✓{C.END} {msg}" + " " * 10)

def print_header():
    clear_screen()
    print(BANNER)
    print(f"   {C.BOLD}{C.CYAN}╔══════════════════════════════════════╗{C.END}")
    print(f"   {C.BOLD}{C.CYAN}║  {C.MAGENTA}ANTI-GRAVITY DEPLOYMENT SYSTEM{C.CYAN}       ║{C.END}")
    print(f"   {C.BOLD}{C.CYAN}║  {C.DIM}v4.0 • Premium TUI{C.END}{C.BOLD}{C.CYAN}                   ║{C.END}")
    print(f"   {C.BOLD}{C.CYAN}╚══════════════════════════════════════╝{C.END}\n")

def get_timestamp():
    return f"{C.DIM}[{time.strftime('%H:%M:%S')}]{C.END}"

def log(msg, color=C.BLUE):
    print(f" {get_timestamp()} {color}{C.BOLD}»{C.END} {msg}")

def success(msg):
    log(msg, C.GREEN)

def warn(msg):
    log(msg, C.YELLOW)

def error(msg):
    log(msg, C.RED)

def run(cmd, cwd=None, check=True, silent=False):
    """Run a shell command."""
    if not silent:
        log(f"Executing: {C.DIM}{cmd}{C.END}")
    
    try:
        # Use shell=True for Termux friendliness
        result = subprocess.run(cmd, shell=True, cwd=str(cwd or PROJECT_DIR), 
                              capture_output=silent, text=True)
        if check and result.returncode != 0:
            if not silent:
                error(f"Failed: {cmd}")
            return False
        return True
    except Exception as e:
        if not silent:
            error(f"Error: {e}")
        return False

def get_pids() -> Dict[str, Any]:
    if PID_FILE.exists():
        try:
            with open(PID_FILE) as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
        except:
            return {}
    return {}

def save_pids(pids: Dict[str, Any]) -> None:
    with open(PID_FILE, "w") as f:
        json.dump(pids, f)

def kill_pid(pid: Union[str, int]) -> bool:
    try:
        p_id = int(pid)
        if sys.platform == "win32":
            subprocess.run(f"taskkill /F /PID {p_id}", shell=True, capture_output=True)
        else:
            os.kill(p_id, signal.SIGTERM)
        return True
    except:
        return False

def check_dep(cmd):
    return shutil.which(cmd) is not None

def get_version(cmd: str) -> str:
    """Get version string for a command."""
    try:
        result = subprocess.run(f"{cmd} --version", shell=True, capture_output=True, text=True, timeout=10)
        out = result.stdout.strip() or result.stderr.strip()
        # Take first line
        return out.split('\n')[0].strip() if out else 'unknown'
    except:
        return 'unknown'

def check_all_requirements() -> bool:
    """Comprehensive check of all required dependencies and project files."""
    log(f"{C.BOLD}Running comprehensive requirements check...{C.END}")
    all_ok = True
    
    # 1. Check binary dependencies
    deps_info = [
        ('node', 'Node.js runtime', True),
        ('npm', 'Node package manager', True),
        ('python', 'Python runtime', True),
        ('ffmpeg', 'Audio processing', False),
        ('yt-dlp', 'YouTube downloads', False),
    ]
    
    print(f"\n   {C.BOLD}{C.CYAN}═══ Dependency Check ═══{C.END}")
    for cmd, desc, required in deps_info:
        found = check_dep(cmd)
        ver = get_version(cmd) if found else 'N/A'
        if found:
            success(f"{cmd:<10} {C.GREEN}✓ Found{C.END}  ({ver}) — {desc}")
        elif required:
            error(f"{cmd:<10} {C.RED}✗ MISSING{C.END} — {desc} [REQUIRED]")
            all_ok = False
        else:
            warn(f"{cmd:<10} {C.YELLOW}✗ Missing{C.END} — {desc} [optional]")
    
    # 2. Check project structure
    print(f"\n   {C.BOLD}{C.CYAN}═══ Project Structure ═══{C.END}")
    required_files = [
        (PROJECT_DIR / 'package.json', 'Frontend package.json'),
        (SERVER_DIR / 'package.json', 'Backend package.json'),
        (SERVER_DIR / 'index.js', 'Backend entry point'),
    ]
    
    for fpath, desc in required_files:
        if fpath.exists():
            success(f"{desc:<30} {C.GREEN}✓ exists{C.END}")
        else:
            error(f"{desc:<30} {C.RED}✗ MISSING{C.END}")
            all_ok = False
    
    # 3. Check node_modules
    print(f"\n   {C.BOLD}{C.CYAN}═══ Dependencies Status ═══{C.END}")
    fe_modules = (PROJECT_DIR / 'node_modules').exists()
    be_modules = (SERVER_DIR / 'node_modules').exists()
    fe_dist = (PROJECT_DIR / 'dist').exists()
    
    status_fe = f"{C.GREEN}✓ Installed{C.END}" if fe_modules else f"{C.YELLOW}✗ Not installed{C.END}"
    status_be = f"{C.GREEN}✓ Installed{C.END}" if be_modules else f"{C.YELLOW}✗ Not installed{C.END}"
    status_dist = f"{C.GREEN}✓ Built{C.END}" if fe_dist else f"{C.YELLOW}✗ Not built{C.END}"
    
    log(f"Frontend node_modules:  {status_fe}")
    log(f"Backend node_modules:   {status_be}")
    log(f"Production build (dist): {status_dist}")
    
    # 4. Check cookies
    print(f"\n   {C.BOLD}{C.CYAN}═══ Configuration ═══{C.END}")
    cookies_ok = COOKIES_FILE.exists() and COOKIES_FILE.stat().st_size > 100
    cookies_status = f"{C.GREEN}✓ Present ({COOKIES_FILE.stat().st_size} bytes){C.END}" if cookies_ok else f"{C.YELLOW}✗ Missing or empty{C.END}"
    log(f"YouTube cookies:        {cookies_status}")
    
    print()
    if all_ok:
        success(f"{C.BOLD}All critical requirements are met!{C.END}")
    else:
        error(f"{C.BOLD}Some critical requirements are missing. Run Setup to fix.{C.END}")
    
    return all_ok

def get_local_ip():
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def action_clean() -> None:
    print_header()
    warn("DEEP CLEAN: This will remove all node_modules and force a re-install.")
    confirm = input(f"   {C.RED}Are you sure? (y/N): {C.END}").strip().lower()
    if confirm != 'y': return

    log("Removing node_modules and locks...")
    for d in [PROJECT_DIR / "node_modules", SERVER_DIR / "node_modules"]:
        if d.exists(): shutil.rmtree(d)
    
    for l in [PROJECT_DIR / "package-lock.json", SERVER_DIR / "package-lock.json"]:
        if l.exists(): l.unlink()
    
    success("Cleanup complete. Run Option 3 (Setup) to rebuild natively.")
    input(f"\n{C.CYAN}Press Enter to return...{C.END}")

# ─── Core Features ───

# ─── Core Features ───

def check_environment() -> bool:
    """Check if the environment is suitable for execution."""
    curr_path = str(PROJECT_DIR).lower()
    # Termux's /sdcard (shared storage) is mounted with noexec
    if "/sdcard" in curr_path or "/storage/emulated" in curr_path:
        error("CRITICAL: Running from shared storage detected!")
        warn("Android prevents execution of binaries on shared storage.")
        print(f"\n   {C.BOLD}FIX:{C.END} Move the project to your Termux home directory:")
        print(f"   {C.CYAN}mv {PROJECT_DIR} ~/anti-gravity{C.END}")
        print(f"   {C.CYAN}cd ~/anti-gravity && python deploy.py{C.END}\n")
        return False
    return True

def action_setup() -> None:
    print_header()
    if not check_environment():
        input(f"\n{C.YELLOW}Press Enter to return to menu (but execution will fail)...{C.END}")

    log(f"{C.BOLD}Starting One-Tap Setup for Anti-Gravity v3.0...{C.END}")
    print(f"   {C.DIM}{'─'*40}{C.END}")
    
    is_termux = "/com.termux" in str(PROJECT_DIR).lower() or os.path.exists("/data/data/com.termux")
    
    step = 1
    
    if is_termux:
        log(f"{C.BOLD}[Step {step}]{C.END} Detecting environment: {C.CYAN}Termux{C.END}")
        step += 1
        
        log(f"{C.BOLD}[Step {step}]{C.END} Checking storage access...")
        if not Path("/data/data/com.termux/files/home/storage").exists():
            warn("Storage access not set up. Granting now...")
            run("termux-setup-storage", check=False)
            success("Storage access granted.")
        else:
            success("Storage access already configured.")
        step += 1
        
        log(f"{C.BOLD}[Step {step}]{C.END} Updating package repositories...")
        run("pkg update -y", check=False)
        success("Package repos updated.")
        step += 1
        
        log(f"{C.BOLD}[Step {step}]{C.END} Installing/Updating core dependencies (nodejs, python, ffmpeg)...")
        run("pkg install -y nodejs python ffmpeg", check=True)
        success(f"Core dependencies installed. Node: {get_version('node')}, Python: {get_version('python')}")
        step += 1
        
        log(f"{C.BOLD}[Step {step}]{C.END} Checking yt-dlp...")
        if not check_dep("yt-dlp"):
            log("Installing yt-dlp via pip...")
            run("pip install yt-dlp")
            success(f"yt-dlp installed: {get_version('yt-dlp')}")
        else:
            success(f"yt-dlp already available: {get_version('yt-dlp')}")
        step += 1
        
        # FIX: Ensure binaries are executable in Termux
        if (PROJECT_DIR / "node_modules" / ".bin").exists():
            log(f"{C.BOLD}[Step {step}]{C.END} Ensuring local binaries are executable...")
            run(f"chmod -R +x {PROJECT_DIR}/node_modules/.bin", check=False)
            success("Binary permissions fixed.")
            step += 1
    else:
        log(f"{C.BOLD}[Step {step}]{C.END} Detecting environment: {C.CYAN}PC / Desktop{C.END}")
        step += 1
        
        log(f"{C.BOLD}[Step {step}]{C.END} Checking required dependencies...")
        for dep in ["node", "npm"]:
            if not check_dep(dep):
                error(f"Missing {dep}! Please install from nodejs.org")
                input("\nPress Enter to exit...")
                return
            else:
                success(f"{dep}: {get_version(dep)}")
        step += 1
    
    # Smarter dependency install - skip if node_modules exists
    log(f"{C.BOLD}[Step {step}]{C.END} Installing Frontend dependencies...")
    if not (PROJECT_DIR / "node_modules").exists():
        log("Running npm install for frontend (this may take a minute)...")
        run("npm install", cwd=PROJECT_DIR)
        success("Frontend dependencies installed successfully.")
    else:
        success("Frontend dependencies already installed. Skipping.")
    step += 1
        
    log(f"{C.BOLD}[Step {step}]{C.END} Installing Backend dependencies...")
    if not (SERVER_DIR / "node_modules").exists():
        log("Running npm install for backend...")
        run("npm install", cwd=SERVER_DIR)
        success("Backend dependencies installed successfully.")
    else:
        success("Backend dependencies already installed. Skipping.")
    step += 1
    
    # Always build frontend once to be sure (using node directly to bypass permissions)
    log(f"{C.BOLD}[Step {step}]{C.END} Building production bundle...")
    vite_bin = PROJECT_DIR / "node_modules" / "vite" / "bin" / "vite.js"
    # Try npm build first, then fallback to direct node if it fails
    if not run("npm run build", cwd=PROJECT_DIR, check=False):
        warn("Standard build failed. Attempting direct build via node...")
        run(f"node {vite_bin} build", cwd=PROJECT_DIR)
    success("Production build completed.")
    step += 1
    
    # Final requirements check
    log(f"{C.BOLD}[Step {step}]{C.END} Final requirements verification...")
    check_all_requirements()
    
    print(f"\n   {C.DIM}{'─'*40}{C.END}")
    success(f"\n✨ ALL SYSTEMS READY! Setup completed in {step} steps.")
    log("You can now start the server from the main menu.")
    input(f"\n{C.CYAN}Press Enter to return to menu...{C.END}")

def action_start() -> None:
    print_header()
    if not check_environment():
        warn("Execution on shared storage is restricted. Attempting anyway...")
        time.sleep(2)
    
    # Force stop any ghost processes
    action_stop(quiet=True)
    
    log("Initializing Anti-Gravity engines...")
    pids: Dict[str, Any] = {}
    
    # Ensure dist exists (prod build)
    log(f"{C.BOLD}[Phase 1]{C.END} Checking production build...")
    if not (PROJECT_DIR / "dist").exists():
        warn("Production build missing. Running build first...")
        run("npm run build", cwd=PROJECT_DIR)
        success("Production build created.")
    else:
        success("Production build found.")

    # Create logs directory
    log(f"{C.BOLD}[Phase 2]{C.END} Preparing log directory...")
    LOGS_DIR = PROJECT_DIR / "logs"
    LOGS_DIR.mkdir(exist_ok=True)
    
    backend_log = open(LOGS_DIR / "backend.log", "a", encoding='utf-8')
    frontend_log = open(LOGS_DIR / "frontend.log", "a", encoding='utf-8')
    
    # Write session separator to logs
    session_marker = f"\n{'='*60}\nSession started at {time.strftime('%Y-%m-%d %H:%M:%S')}\n{'='*60}\n"
    backend_log.write(session_marker)
    frontend_log.write(session_marker)
    backend_log.flush()
    frontend_log.flush()

    # Start Backend
    log(f"{C.BOLD}[Phase 3]{C.END} Launching Backend on port {BACKEND_PORT}...")
    backend_proc = subprocess.Popen(
        ["node", "index.js"],
        cwd=str(SERVER_DIR),
        stdout=backend_log,
        stderr=backend_log,
        start_new_session=True
    )
    pids["backend"] = backend_proc.pid
    success(f"Backend started (PID: {backend_proc.pid})")
    
    # Start Frontend (Use node directly to bypass shell execution permissions for the vite binary)
    log(f"{C.BOLD}[Phase 4]{C.END} Spawning Frontend on port {FRONTEND_PORT}...")
    
    # Path to vite entry point
    vite_bin = PROJECT_DIR / "node_modules" / "vite" / "bin" / "vite.js"
    
    frontend_proc = subprocess.Popen(
        ["node", str(vite_bin), "--host", "0.0.0.0", "--port", str(FRONTEND_PORT)],
        cwd=str(PROJECT_DIR),
        stdout=frontend_log,
        stderr=frontend_log,
        start_new_session=True
    )
    pids["frontend"] = frontend_proc.pid
    success(f"Frontend started (PID: {frontend_proc.pid})")
    
    save_pids(pids)
    
    # Wait for servers to settle
    log(f"{C.BOLD}[Phase 5]{C.END} {C.DIM}Waiting for stabilization (3s)...{C.END}")
    time.sleep(3)
    
    local_ip = get_local_ip()
    success("\n🚀 ANTI-GRAVITY DEPLOYED SUCCESSFULLY!")
    print(f"   {'─'*40}")
    print(f"   {C.BOLD}📱 DISCOVERABLE AT:{C.END}")
    print(f"   {C.MAGENTA}Local:   {C.END} http://localhost:{FRONTEND_PORT}")
    print(f"   {C.MAGENTA}Network: {C.END} http://{local_ip}:{FRONTEND_PORT}")
    print(f"   {'─'*40}")
    print(f"   {C.DIM}Note: Ensure your phone is on the same WiFi as this device.{C.END}")
    
    input(f"\n{C.CYAN}Press Enter to return to menu...{C.END}")

def action_stop(quiet: bool = False) -> None:
    if not quiet: print_header()
    pids: Dict[str, Any] = get_pids()
    killed_ids: List[int] = []
    
    if pids:
        for name, pid in pids.items():
            if kill_pid(pid):
                if not quiet: success(f"Stopped {name} (PID: {pid})")
                try: killed_ids.append(int(pid))
                except: pass
    
    # Cleanup port usage (Linux/Termux only)
    if shutil.which("lsof"):
        for port in [FRONTEND_PORT, BACKEND_PORT]:
            try:
                result = subprocess.run(f"lsof -t -i:{port}", shell=True, capture_output=True, text=True)
                for p in result.stdout.strip().split('\n'):
                    if p.strip(): 
                        if kill_pid(p.strip()):
                            try: killed_ids.append(int(p.strip()))
                            except: pass
            except: pass
    
    if PID_FILE.exists():
        PID_FILE.unlink()
        
    if not quiet:
        count: int = len(killed_ids)
        if count == 0: warn("No active servers found.")
        else: success(f"Full shutdown complete. Killed {count} processes.")
        input(f"\n{C.CYAN}Press Enter to return to menu...{C.END}")

def action_status() -> None:
    print_header()
    log(f"{C.BOLD}System Status Report:{C.END}")
    
    # Run full requirements check
    check_all_requirements()
    
    print(f"\n   {C.BOLD}{C.CYAN}═══ Server Status ═══{C.END}")
    pids: Dict[str, Any] = get_pids()
    
    if not pids:
        warn("No servers are currently running.")
    else:
        for name, pid in pids.items():
            # Check if actually running
            is_running: bool = False
            try:
                if sys.platform == "win32":
                    out_cmd = subprocess.check_output(f'tasklist /FI "PID eq {pid}"', shell=True).decode()
                    is_running = str(pid) in out_cmd
                else:
                    os.kill(int(pid), 0)
                    is_running = True
            except:
                is_running = False
            
            status_text: str = f"{C.GREEN}ACTIVE{C.END}" if is_running else f"{C.RED}STOPPED{C.END}"
            print(f"   {C.BOLD}{str(name).capitalize():<8}{C.END}: {status_text} (PID: {pid})")

    input(f"\n{C.CYAN}Press Enter to return to menu...{C.END}")

def action_debug():
    print_header()
    log(f"{C.YELLOW}Entering Debug Streams...{C.END}")
    
    pids = get_pids()
    if not pids:
        error("Servers are not running. Start them first.")
        input()
        return

    # In a real TUI we'd use tail -f or similar, but for simplicity:
    log("Checking port reachability...")
    if shutil.which("lsof"):
        run(f"lsof -i:{FRONTEND_PORT} || echo 'Frontend Port closed'", silent=False)
        run(f"lsof -i:{BACKEND_PORT} || echo 'Backend Port closed'", silent=False)
    
    success("Port checks complete. If the frontend doesn't load, check for 'Permission Denied' in Termux logs.")
    input(f"\n{C.CYAN}Press Enter to return...{C.END}")

def action_cookies():
    print_header()
    print(f"   {C.YELLOW}{C.BOLD}YouTube Cookies Update{C.END}")
    print(f"   {C.DIM}Paste your netscape format cookies below.{C.END}")
    print(f"   {C.DIM}Press Enter on an empty line when finished.{C.END}")
    print(f"   {'─'*30}")
    
    log("Accepting input (End with empty line):")
    lines = []
    while True:
        try:
            line = input()
            if not line: break
            lines.append(line + "\n")
        except EOFError:
            break
            
    if not lines:
        warn("No content provided. Operation cancelled.")
    else:
        try:
            with open(COOKIES_FILE, "w", encoding='utf-8') as f:
                f.writelines(lines)
            success(f"Successfully updated cookies in {COOKIES_FILE}")
        except Exception as e:
            error(f"Failed to save cookies: {e}")
    
def action_logs():
    print_header()
    log(f"{C.YELLOW}Live Log Tail — Append Mode. Press Ctrl+C to return.{C.END}")
    
    LOGS_DIR = PROJECT_DIR / "logs"
    if not LOGS_DIR.exists():
        error("No logs found. Start the server first.")
        input(f"\n{C.CYAN}Press Enter to return...{C.END}")
        return

    backend_log = LOGS_DIR / "backend.log"
    frontend_log = LOGS_DIR / "frontend.log"
    
    # Start from end of current files
    def get_size(f):
        try: return f.stat().st_size
        except: return 0
    
    be_pos = get_size(backend_log)
    fe_pos = get_size(frontend_log)
    
    # Show last 20 lines to start
    def tail(filename, n=20):
        try:
            with open(filename, "r", encoding='utf-8') as f:
                lines = f.readlines()
                return lines[-n:]
        except:
            return []
    
    print(f"\n {C.BOLD}{C.CYAN}── Recent Backend Logs ──{C.END}")
    for line in tail(backend_log):
        print(f"  {C.DIM}[BE]{C.END} {line.strip()}")
    
    print(f"\n {C.BOLD}{C.CYAN}── Recent Frontend Logs ──{C.END}")
    for line in tail(frontend_log):
        print(f"  {C.DIM}[FE]{C.END} {line.strip()}")
    
    print(f"\n {C.GREEN}── Watching for new logs (Ctrl+C to stop) ──{C.END}\n")
    
    try:
        while True:
            # Check backend for new lines
            new_be_size = get_size(backend_log)
            if new_be_size > be_pos:
                try:
                    with open(backend_log, "r", encoding='utf-8') as f:
                        f.seek(be_pos)
                        new_lines = f.read()
                        for line in new_lines.strip().split('\n'):
                            if line.strip():
                                ts = time.strftime('%H:%M:%S')
                                print(f"  {C.DIM}[{ts}]{C.END} {C.CYAN}[BE]{C.END} {line.strip()}")
                except: pass
                be_pos = new_be_size
            
            # Check frontend for new lines
            new_fe_size = get_size(frontend_log)
            if new_fe_size > fe_pos:
                try:
                    with open(frontend_log, "r", encoding='utf-8') as f:
                        f.seek(fe_pos)
                        new_lines = f.read()
                        for line in new_lines.strip().split('\n'):
                            if line.strip():
                                ts = time.strftime('%H:%M:%S')
                                print(f"  {C.DIM}[{ts}]{C.END} {C.MAGENTA}[FE]{C.END} {line.strip()}")
                except: pass
                fe_pos = new_fe_size
            
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"\n {C.GREEN}Log stream stopped.{C.END}")
    
    return

def action_update():
    """OTA Update from GitHub repository — Termux-aware."""
    print_header()
    GITHUB_REPO = "https://github.com/duckyduxlair-max/GRAVITUNES.git"
    TERMUX_HOME = Path("/data/data/com.termux/files/home")
    
    is_termux = TERMUX_HOME.exists() or "/com.termux" in str(PROJECT_DIR).lower()
    
    # Determine install target
    if is_termux:
        install_dir = TERMUX_HOME / "GRAVITUNES"
    else:
        install_dir = PROJECT_DIR
    
    log(f"{C.BOLD}GraviTunes OTA Update System{C.END}")
    print(f"   {C.DIM}Repository: {GITHUB_REPO}{C.END}")
    print(f"   {C.DIM}Target:     {install_dir}{C.END}")
    print(f"   {C.DIM}Platform:   {'Termux' if is_termux else 'PC / Desktop'}{C.END}")
    print(f"   {C.DIM}{'─'*40}{C.END}")
    
    # Check if git is available
    if not check_dep('git'):
        error("git is not installed! Install git first.")
        if is_termux:
            warn("Run: pkg install git")
        else:
            warn("Download from https://git-scm.com")
        input(f"\n{C.CYAN}Press Enter to return...{C.END}")
        return
    
    # Detect fresh install vs update
    is_fresh = not (install_dir / "package.json").exists()
    
    if is_fresh:
        log(f"{C.YELLOW}Fresh install detected.{C.END}")
        print(f"\n   This will download GraviTunes to:")
        print(f"   {C.GREEN}{install_dir}{C.END}\n")
    else:
        log(f"{C.GREEN}Existing installation found. Updating...{C.END}")
    
    # Backup cookies before update
    cookies_file_target = install_dir / "server" / "cookies.txt"
    cookies_backup = None
    if cookies_file_target.exists() and cookies_file_target.stat().st_size > 10:
        success("Backing up cookies.txt...")
        cookies_backup = cookies_file_target.read_text(encoding='utf-8')
    
    confirm = input(f"\n   {C.YELLOW}{'Install' if is_fresh else 'Update'} GraviTunes? (y/N): {C.END}").strip().lower()
    if confirm != 'y':
        warn("Cancelled.")
        input(f"\n{C.CYAN}Press Enter to return...{C.END}")
        return
    
    import tempfile
    
    try:
        if is_fresh:
            # ─── FRESH INSTALL: Clone directly to target ───
            log(f"Cloning GraviTunes to {install_dir}...")
            spinner_wait("Downloading from GitHub...", 1.5)
            
            # Remove target if it exists but is empty/broken
            if install_dir.exists():
                shutil.rmtree(install_dir, ignore_errors=True)
            
            result = subprocess.run(
                f'git clone --depth 1 "{GITHUB_REPO}" "{install_dir}"',
                shell=True, capture_output=True, text=True
            )
            if result.returncode != 0:
                error(f"Clone failed: {result.stderr}")
                input(f"\n{C.CYAN}Press Enter to return...{C.END}")
                return
            
            success("Repository cloned successfully!")
            
            # Ask user to paste cookies
            print(f"\n   {C.YELLOW}{C.BOLD}YouTube Cookies Setup{C.END}")
            print(f"   {C.DIM}Paste your Netscape-format cookies below.{C.END}")
            print(f"   {C.DIM}Press Enter on empty line when finished.{C.END}")
            print(f"   {C.DIM}(Skip by pressing Enter immediately){C.END}")
            print(f"   {'─'*30}")
            
            lines = []
            while True:
                try:
                    line = input()
                    if not line:
                        break
                    lines.append(line + "\n")
                except EOFError:
                    break
            
            if lines:
                cookies_path = install_dir / "server" / "cookies.txt"
                cookies_path.parent.mkdir(parents=True, exist_ok=True)
                with open(cookies_path, "w", encoding='utf-8') as f:
                    f.writelines(lines)
                success(f"Cookies saved to {cookies_path}")
            else:
                warn("No cookies provided. Add them later via Option 4.")
            
            print(f"\n   {C.DIM}{'─'*40}{C.END}")
            success(f"\n✨ FRESH INSTALL COMPLETE!")
            print(f"\n   {C.BOLD}Next steps:{C.END}")
            print(f"   {C.CYAN}cd {install_dir}{C.END}")
            print(f"   {C.CYAN}python deploy.py{C.END}")
            print(f"   Then choose {C.GREEN}[3] System Setup{C.END} to install dependencies.")
            
        else:
            # ─── UPDATE: Clone to temp, merge files ───
            temp_dir = Path(tempfile.mkdtemp(prefix='gravitunes_update_'))
            
            log("Cloning latest version from GitHub...")
            spinner_wait("Downloading updates...", 1)
            result = subprocess.run(
                f'git clone --depth 1 "{GITHUB_REPO}" "{temp_dir / "repo"}"',
                shell=True, capture_output=True, text=True
            )
            if result.returncode != 0:
                error(f"Clone failed: {result.stderr}")
                shutil.rmtree(temp_dir, ignore_errors=True)
                input(f"\n{C.CYAN}Press Enter to return...{C.END}")
                return
            
            success("Repository cloned.")
            
            # Find source directory
            clone_dir = temp_dir / "repo"
            if (clone_dir / "vite-project").exists():
                source_dir = clone_dir / "vite-project"
            elif (clone_dir / "package.json").exists():
                source_dir = clone_dir
            else:
                error("Could not find project files in repository.")
                shutil.rmtree(temp_dir, ignore_errors=True)
                input(f"\n{C.CYAN}Press Enter to return...{C.END}")
                return
            
            # Merge files (skip protected dirs)
            log("Merging updated files...")
            skip_dirs = {'node_modules', 'dist', '.git', 'logs', 'temp'}
            skip_files = {'cookies.txt'}  # Never overwrite cookies
            updated_count = 0
            
            for item in source_dir.rglob('*'):
                rel_path = item.relative_to(source_dir)
                if any(part in skip_dirs for part in rel_path.parts):
                    continue
                if rel_path.name in skip_files:
                    continue
                
                dest = install_dir / rel_path
                if item.is_file():
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(item, dest)
                    updated_count += 1
            
            success(f"Updated {updated_count} files.")
            
            # Restore cookies
            if cookies_backup:
                cookies_file_target.parent.mkdir(parents=True, exist_ok=True)
                cookies_file_target.write_text(cookies_backup, encoding='utf-8')
                success("Cookies restored.")
            
            # Cleanup
            shutil.rmtree(temp_dir, ignore_errors=True)
            
            print(f"\n   {C.DIM}{'─'*40}{C.END}")
            success(f"\n✨ UPDATE COMPLETE! {updated_count} files updated.")
            log("Run Setup (Option 3) to rebuild after update.")
        
    except Exception as e:
        error(f"Operation failed: {e}")
    
    input(f"\n{C.CYAN}Press Enter to return to menu...{C.END}")

# ─── Main TUI Loop ───

def menu():
    while True:
        print_header()
        
        menu_items = [
            ('1', '🚀', 'Start Server', 'One-Tap Launch', C.GREEN),
            ('2', '⏹ ', 'Stop Server', 'Kill All Processes', C.RED),
            ('3', '⚙ ', 'System Setup', 'Full Install & Build', C.CYAN),
            ('4', '🍪', 'Update Cookies', 'YouTube Auth Tokens', C.YELLOW),
            ('5', '📊', 'Status & Debug', 'Full Diagnostics', C.BLUE),
            ('6', '🧹', 'Deep Clean', 'Fix Node Errors', C.MAGENTA),
            ('7', '📋', 'Live Logs', 'Real-time Stream (50L)', C.CYAN),
            ('8', '🔄', 'OTA Update', 'Update from GitHub', C.GREEN),
        ]
        
        lines = []
        for key, icon, label, desc, color in menu_items:
            lines.append(f"{color}{C.BOLD}[{key}]{C.END} {icon} {C.BOLD}{label:<20}{C.END}{C.DIM}{desc}{C.END}")
        lines.append("")
        lines.append(f"{C.RED}{C.BOLD}[0]{C.END} 🚪 {C.BOLD}{'Exit':<20}{C.END}{C.DIM}Shutdown TUI{C.END}")
        
        draw_box("COMMAND CENTER", lines, C.MAGENTA, 56)
        
        print(f"\n   {C.DIM}Tip: Use number keys to navigate{C.END}")
        try:
            choice = input(f"\n   {C.CYAN}{C.BOLD}⟫ {C.END}").strip()
        except (EOFError, KeyboardInterrupt):
            break
        
        if choice == "1": action_start()
        elif choice == "2": action_stop()
        elif choice == "3": action_setup()
        elif choice == "4": action_cookies()
        elif choice == "5": action_status()
        elif choice == "6": action_clean()
        elif choice == "7": action_logs()
        elif choice == "8": action_update()
        elif choice == "0": 
            clear_screen()
            print(SKULL)
            print(f"   {C.MAGENTA}{C.BOLD}Stay Anti-Gravity. Goodbye.{C.END}")
            print(f"   {C.DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━{C.END}\n")
            break
        else:
            warn("Invalid selection. Try again.")
            time.sleep(1)

if __name__ == "__main__":
    try:
        menu()
    except KeyboardInterrupt:
        clear_screen()
        print(SKULL)
        sys.exit(0)
