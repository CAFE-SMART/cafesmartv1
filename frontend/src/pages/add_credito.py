import sys
f=open(r"C:\Users\fcoib\cafesmartv1\frontend\src\pages\Compras.tsx","r",encoding="utf-8")
l=f.readlines()
f.close()
new=["import { obtenerCreditoAPI } from \"../services/creditoService\";\n","\n"]
out=l[:58]+new+l[58:]
f2=open(r"C:\Users\fcoib\cafesmartv1\frontend\src\pages\Compras.tsx","w",encoding="utf-8")
f2.writelines(out)
f2.close()
print("import credito agregado")
f=open(r"C:\Users\fcoib\cafesmartv1\frontend\src\pages\Compras.tsx","r",encoding="utf-8")
l=f.readlines()
f.close()
banner=["\nconst CreditoBanner = ({ credito }: { credito: any }) => {\n","  if (!credito || credito.estado === \"NO_CONFIGURADO\" || credito.estado === \"SIN_LIMITE\") return null;\n","  const isBloqueado = credito.estado === \"BLOQUEADO\";\n","  return (\n","    <div className={isBloqueado ? \"border-red-200 bg-red-50 mx-5 mt-3 rounded-xl border p-3\" : \"border-blue-200 bg-blue-50 mx-5 mt-3 rounded-xl border p-3\"}>\n","      <p className={isBloqueado ? \"text-xs font-bold text-red-800\" : \"text-xs font-bold text-blue-800\"}>Credito Disponible</p>\n","      <p className={isBloqueado ? \"text-lg font-black text-red-900\" : \"text-lg font-black text-blue-900\"}>\n","        {credito.disponible.toLocaleString(\"es-CO\")} COP\n","      </p>\n","    </div>\n","  );\n","};\n"]
idx=l.index(next(x for x in l if "export function ComprasPage()" in x))
l2=l[:idx]+banner+l[idx:]
f2=open(r"C:\Users\fcoib\cafesmartv1\frontend\src\pages\Compras.tsx","w",encoding="utf-8")
f2.writelines(l2)
f2.close()
print("Banner agregado")
