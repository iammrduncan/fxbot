# fxbot's herdr plugin: runs herdr's client in a pseudo-terminal, for a terminal in the page (docs/phases/herdr-screen.md).
# Its arguments are the rows, the columns, and the command. What the terminal draws goes to standard output, as it comes.
# Standard input is framed: a byte for the kind, four for the length, big-endian, then the payload. Kind 0 is typed
# bytes, and kind 1 a new size, rows then columns, each two bytes. It ends when the command does, or the input does.
# The door runs a copy of this, in deploy/herdr-door: keep the two the same.
import fcntl, os, pty, select, signal, struct, sys, termios

def size(fd, rows, cols):
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", max(1, min(rows, 500)), max(1, min(cols, 500)), 0, 0))

def send(fd, data):
    while data:
        data = data[os.write(fd, data):]

rows, cols, argv = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3:]
pid, fd = pty.fork()
if pid == 0:
    size(0, rows, cols)
    os.environ["TERM"] = "xterm-256color"
    os.execvp(argv[0], argv)
waiting = b""
try:
    while True:
        ready, _, _ = select.select([fd, 0], [], [])
        if fd in ready:
            try:
                drawn = os.read(fd, 65536)
            except OSError:
                drawn = b""
            if not drawn:
                break
            send(1, drawn)
        if 0 in ready:
            got = os.read(0, 65536)
            if not got:
                break
            waiting += got
            while len(waiting) >= 5:
                kind, length = waiting[0], struct.unpack(">I", waiting[1:5])[0]
                if length > 1 << 20:
                    raise SystemExit(1)
                if len(waiting) < 5 + length:
                    break
                payload, waiting = waiting[5 : 5 + length], waiting[5 + length :]
                if kind == 0:
                    send(fd, payload)
                elif kind == 1 and length == 4:
                    size(fd, *struct.unpack(">HH", payload))
except (BrokenPipeError, ConnectionResetError):
    pass
finally:
    for sig in (signal.SIGHUP, signal.SIGKILL):
        try:
            os.kill(pid, sig)
            os.waitpid(pid, 0) if sig == signal.SIGKILL else None
        except (ProcessLookupError, ChildProcessError):
            break
