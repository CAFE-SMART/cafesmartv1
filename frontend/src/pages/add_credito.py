from pathlib import Path


PAGES_DIR = Path(__file__).resolve().parent
COMPRAS_FILE = PAGES_DIR / "Compras.tsx"


def read_compras() -> list[str]:
    return COMPRAS_FILE.read_text(encoding="utf-8").splitlines(keepends=True)


def write_compras(lines: list[str]) -> None:
    COMPRAS_FILE.write_text("".join(lines), encoding="utf-8")


lines = read_compras()
import_line = 'import { obtenerCreditoAPI } from "../services/creditoService";\n'

if import_line not in lines:
    lines = lines[:58] + [import_line, "\n"] + lines[58:]
    write_compras(lines)
    print("import credito agregado")
else:
    print("import credito ya existia")

lines = read_compras()
banner = [
    "\nconst CreditoBanner = ({ credito }: { credito: any }) => {\n",
    '  if (!credito || credito.estado === "NO_CONFIGURADO" || credito.estado === "SIN_LIMITE") return null;\n',
    '  const isBloqueado = credito.estado === "BLOQUEADO";\n',
    "  return (\n",
    '    <div className={isBloqueado ? "border-red-200 bg-red-50 mx-5 mt-3 rounded-xl border p-3" : "border-blue-200 bg-blue-50 mx-5 mt-3 rounded-xl border p-3"}>\n',
    '      <p className={isBloqueado ? "text-xs font-bold text-red-800" : "text-xs font-bold text-blue-800"}>Credito Disponible</p>\n',
    '      <p className={isBloqueado ? "text-lg font-black text-red-900" : "text-lg font-black text-blue-900"}>\n',
    '        {credito.disponible.toLocaleString("es-CO")} COP\n',
    "      </p>\n",
    "    </div>\n",
    "  );\n",
    "};\n",
]

if not any("const CreditoBanner =" in line for line in lines):
    export_index = next(
        index for index, line in enumerate(lines) if "export function ComprasPage()" in line
    )
    lines = lines[:export_index] + banner + lines[export_index:]
    write_compras(lines)
    print("Banner agregado")
else:
    print("Banner ya existia")
