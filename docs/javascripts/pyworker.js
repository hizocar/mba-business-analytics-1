/*
 * Python kernel for the site, running Pyodide inside a Web Worker so long
 * computations never freeze the page. Driven by pyrunner.js.
 *
 * in:  {type: "run", id, page, code, inputs} | {type: "warm"}
 * out: {type: "status", state, text}
 *      {type: "output", id, kind: "stream" | "display" | "error", ...}
 *      {type: "done", id, ok}
 */
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/";

// A flaky connection shouldn't cost the student a page reload.
for (let attempt = 1; ; attempt++) {
  try {
    importScripts(PYODIDE + "pyodide.js");
    break;
  } catch (err) {
    if (attempt === 3) throw err;
  }
}

// Pure-Python packages that are not part of the Pyodide distribution.
// They are installed from PyPI with micropip the first time code needs them.
const FROM_PYPI = [
  { test: /\bseaborn\b/, pkg: "seaborn" },
  { test: /read_excel|to_excel|openpyxl/, pkg: "openpyxl" },
];

const BOOT = String.raw`
import ast, base64, builtins, io, linecache, os, sys, traceback, types
os.environ["MPLBACKEND"] = "AGG"

import pyodide_http
pyodide_http.patch_all()   # lets pandas/seaborn read from URLs (synchronous XHR in the worker)

from _hz import emit

_state = {"id": None, "inputs": []}
_namespaces = {}

class _Stream(io.TextIOBase):
    def __init__(self, name):
        self._name = name
    def write(self, s):
        if s:
            emit("stream", _state["id"], self._name, s)
        return len(s)
    def flush(self):
        pass

sys.stdout = _Stream("stdout")
sys.stderr = _Stream("stderr")

def _flush_figures():
    plt = sys.modules.get("matplotlib.pyplot")
    if plt is None:
        return
    for num in plt.get_fignums():
        buf = io.BytesIO()
        plt.figure(num).savefig(buf, format="png", bbox_inches="tight", dpi=100)
        emit("display", _state["id"], "image/png", base64.b64encode(buf.getvalue()).decode())
    plt.close("all")

def _show(obj):
    if obj is None:
        return
    # Like Jupyter, but without the "<matplotlib.lines.Line2D at 0x...>" noise.
    if type(obj).__module__.startswith("matplotlib") or (
        isinstance(obj, (list, tuple)) and obj and type(obj[0]).__module__.startswith("matplotlib")
    ):
        return
    html = getattr(obj, "_repr_html_", None)
    if callable(html):
        try:
            h = html()
            if h:
                emit("display", _state["id"], "text/html", h)
                return
        except Exception:
            pass
    emit("display", _state["id"], "text/plain", repr(obj))

def display(*objs, **kwargs):
    _flush_figures()
    for o in objs:
        _show(o)

def _input(prompt=""):
    if not _state["inputs"]:
        raise RuntimeError("input() has no answer. Type it in the box above the output and run the cell again.")
    answer = _state["inputs"].pop(0)
    print(f"{prompt}{answer}")
    return answer

def _patch_pyplot():
    plt = sys.modules.get("matplotlib.pyplot")
    if plt is not None and getattr(plt.show, "__name__", "") != "_flush_figures":
        plt.show = lambda *a, **k: _flush_figures()
        plt.show.__name__ = "_flush_figures"

def _colab_stub():
    google = sys.modules.setdefault("google", types.ModuleType("google"))
    colab = types.ModuleType("google.colab")
    drive = types.SimpleNamespace(mount=lambda *a, **k: print("(Google Drive is only available in Colab; skipped here.)"))
    def upload(*a, **k):
        raise RuntimeError("files.upload() only works in Colab. On this page, read the data from its URL instead.")
    colab.drive = drive
    colab.files = types.SimpleNamespace(upload=upload, download=lambda *a, **k: print("(Downloads only work in Colab.)"))
    google.colab = colab
    sys.modules["google.colab"] = colab

_colab_stub()

def _strip_magics(code):
    out = []
    for line in code.split("\n"):
        s = line.lstrip()
        if s.startswith(("!", "%")):
            indent = line[: len(line) - len(s)]
            out.append(f"{indent}pass  # {s}  (notebook command, skipped in the browser)")
        else:
            out.append(line)
    return "\n".join(out)

def run(cell_id, page, code, inputs):
    _state["id"] = cell_id
    _state["inputs"] = list(inputs)
    ns = _namespaces.setdefault(page, {"__name__": "__main__", "display": display})
    builtins.input = _input
    if any(k in code for k in ("matplotlib", "seaborn", "plt.")):
        try:
            import matplotlib.pyplot  # imported first so plt.show() can be redirected
        except ImportError:
            pass
    _patch_pyplot()
    src = _strip_magics(code)
    filename = f"<cell {cell_id}>"
    linecache.cache[filename] = (len(src), None, src.splitlines(True), filename)
    try:
        tree = ast.parse(src, filename)
        last = None
        silent = code.rstrip().endswith(";")
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = ast.Expression(tree.body.pop().value)
        exec(compile(tree, filename, "exec"), ns)
        _patch_pyplot()
        value = eval(compile(last, filename, "eval"), ns) if last else None
        _flush_figures()
        if not silent:
            _show(value)
        return True
    except BaseException as e:
        _flush_figures()
        tb = e.__traceback__
        while tb is not None and tb.tb_frame.f_code.co_filename != filename:
            tb = tb.tb_next
        lines = traceback.format_exception(type(e), e, tb)
        emit("error", cell_id, type(e).__name__, str(e), "".join(lines))
        return False
`;

let pyodide = null;
let booting = null;
const loaded = new Set();

const post = (msg) => self.postMessage(msg);
const status = (state, text) => post({ type: "status", state, text });

function boot() {
  if (booting) return booting;
  booting = (async () => {
    status("loading", "Downloading Python (only slow the first time)…");
    pyodide = await loadPyodide({ indexURL: PYODIDE }).catch(() => loadPyodide({ indexURL: PYODIDE }));
    status("loading", "Loading the Python toolkit…");
    await pyodide.loadPackage(["micropip", "pyodide-http"]);
    pyodide.registerJsModule("_hz", {
      emit(kind, id, a, b, c) {
        if (kind === "stream") post({ type: "output", id, kind, name: a, text: b });
        else if (kind === "display") post({ type: "output", id, kind, mime: a, data: b });
        else post({ type: "output", id, kind, ename: a, evalue: b, traceback: c });
      },
    });
    pyodide.runPython(BOOT);
  })();
  return booting;
}

async function ensurePackages(code) {
  // Pyodide reports a failed download through errorCallback and carries on,
  // so failures are collected and the load is retried before giving up.
  let failed;
  const load = () =>
    pyodide.loadPackagesFromImports(code, {
      messageCallback: (m) => {
        const hit = /^Loading (.+)$/.exec(m);
        const pkgs = hit ? hit[1].split(", ") : [];
        const main = pkgs.filter((p) => /^(numpy|pandas|scikit-learn|matplotlib|scipy|statsmodels)$/.test(p));
        status("busy", "Installing " + (main.length ? main.join(", ") : "packages") + (pkgs.length > main.length ? " and helpers" : "") + "… (only the first time)");
      },
      errorCallback: (m) => failed.push(m),
    });
  for (let attempt = 1; ; attempt++) {
    failed = [];
    await load();
    if (!failed.length) break;
    if (attempt === 3) throw new Error("Some Python packages could not be downloaded. Check your connection and run the cell again.");
    status("busy", "Download interrupted, retrying…");
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  const missing = FROM_PYPI.filter((p) => p.test.test(code) && !loaded.has(p.pkg)).map((p) => p.pkg);
  if (missing.length) {
    status("busy", "Installing " + missing.join(", ") + "…");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install(missing);
    missing.forEach((p) => loaded.add(p));
  }
}

// Runs strictly one cell at a time, in arrival order.
let queue = Promise.resolve();
self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "warm") return boot().then(() => status("ready", "Python ready"));
  if (msg.type !== "run") return;
  queue = queue.then(async () => {
    let ok = false;
    try {
      await boot();
      status("busy", "Running…");
      await ensurePackages(msg.code);
      status("busy", "Running…");
      const run = pyodide.globals.get("run");
      ok = run(msg.id, msg.page, msg.code, pyodide.toPy(msg.inputs || []));
      run.destroy();
    } catch (err) {
      post({ type: "output", id: msg.id, kind: "error", ename: "Error", evalue: String(err.message || err), traceback: String(err.message || err) });
    }
    post({ type: "done", id: msg.id, ok });
    status("ready", "Python ready");
  });
};
