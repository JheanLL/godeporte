"""
API Gateway - GoDeporte (Puerto 8080)
Basado en el diseño enseñado en la Unidad 3 (Semana 11) y en la guía práctica.

Responsabilidad:
- Punto de entrada único (Single Entry Point)
- Enrutamiento dinámico hacia microservicios independientes
- Centralización de transversales y aislamiento de errores (HTTP 503)
- Interfaz interactiva de demostración y documentación central
"""
import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI(
    title="API Gateway | GoDeporte",
    description="Puerta de entrada centralizada del sistema GoDeporte.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Catálogo de microservicios registrados en el Gateway
# En producción o con Service Discovery (Eureka/Consul) esto es dinámico
SERVICES = {
    "pagos": os.getenv("PAGOS_SERVICE_URL", "http://127.0.0.1:8003"),
    "reservas": os.getenv("RESERVAS_SERVICE_URL", "http://127.0.0.1:8001")
}

@app.get("/health", tags=["Gateway"])
async def gateway_health():
    """Comprueba el estado de la red de microservicios desde el Gateway."""
    resultados = {"gateway": "UP", "servicios": {}}
    async with httpx.AsyncClient(timeout=2.0) as client:
        for nombre, url in SERVICES.items():
            try:
                resp = await client.get(f"{url}/{nombre}/health")
                resultados["servicios"][nombre] = {
                    "url": url,
                    "status": "UP" if resp.status_code == 200 else f"HTTP {resp.status_code}",
                    "detalle": resp.json() if resp.status_code == 200 else None
                }
            except Exception as e:
                resultados["servicios"][nombre] = {
                    "url": url,
                    "status": "DOWN",
                    "error": str(e)
                }
    return resultados

@app.get("/demo", response_class=HTMLResponse, tags=["Presentación"])
def pagina_demo():
    """Sirve la consola visual interactiva para la exposición."""
    demo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "demo-visual", "index.html")
    if os.path.exists(demo_path):
        with open(demo_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>Consola de demostración lista</h1>"

@app.get("/", response_class=HTMLResponse, tags=["Gateway"])
def inicio():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>API Gateway - GoDeporte</title>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
            .card { background: #1e293b; border-radius: 12px; padding: 24px; max-width: 800px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            h1 { color: #38bdf8; margin-top: 0; }
            .btn { display: inline-block; background: #22c55e; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-right: 12px; }
            .btn-blue { background: #38bdf8; }
            .box { background: #334155; padding: 12px 18px; border-radius: 6px; font-family: monospace; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>API Gateway · GoDeporte</h1>
            <p>Puerta de enlace centralizada (Puerto 8080) según el temario de microservicios de UNU.</p>
            <div style="margin: 24px 0;">
                <a href="/demo" class="btn">🚀 Abrir Consola de Exposición en Vivo</a>
                <a href="/docs" class="btn btn-blue">📖 Swagger / OpenAPI Gateway</a>
            </div>
            <h3>Microservicios Registrados:</h3>
            <div class="box"><b>ms-pagos</b> (Jhean Carlos Tecse Lozano): http://127.0.0.1:8003 -> /pagos/*</div>
            <div class="box"><b>ms-reservas</b> (Jheferson Abel Portocarrero): http://127.0.0.1:8001 -> /reservas/*</div>
        </div>
    </body>
    </html>
    """

# Enrutamiento dinámico hacia microservicios
@app.api_route("/{service}/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def route_gateway(service: str, path: str, request: Request):
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail=f"Microservicio '{service}' no está registrado en el Gateway.")

    target_url = f"{SERVICES[service]}/{service}/{path}"
    
    async with httpx.AsyncClient() as client:
        try:
            req_body = await request.body()
            response = await client.request(
                method=request.method,
                url=target_url,
                params=dict(request.query_params),
                content=req_body,
                headers={"Content-Type": request.headers.get("Content-Type", "application/json")},
                timeout=5.0
            )
            return JSONResponse(
                status_code=response.status_code,
                content=response.json() if response.headers.get("content-type", "").startswith("application/json") else {"mensaje": response.text}
            )
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail=f"[ERROR 503: GATEWAY] El microservicio '{service}' ({SERVICES[service]}) está caído o inalcanzable."
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error en Gateway: {str(e)}")

@app.api_route("/{service}", methods=["GET", "POST"])
async def route_gateway_root(service: str, request: Request):
    return await route_gateway(service, "", request)
