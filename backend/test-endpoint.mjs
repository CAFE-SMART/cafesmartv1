const main = async () => {
    try {
        const response = await fetch('http://localhost:3000/compras', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Default user is user 1, or we can just hope it accepts auth without token or we pass a mock.
            },
            body: JSON.stringify({
                fecha: "2026-04-21T12:00:00.000Z",
                deviceId: "dev-02",
                localId: "loc-03",
                sublotes: [
                  {
                    tipoCafeId: "VERDE-ID", // I'll need valid IDs
                    calidadId: "BUENO-ID",
                    pesoInicial: 44,
                    precioKg: 13200,
                    deviceId: "dev-02",
                    localId: "loc-s3"
                  }
                ]
            })
        });
        const data = await response.json();
        console.log("Status:", response.status);
        console.log("Data:", data);
    } catch(e) {
        console.log(e);
    }
}
main();
