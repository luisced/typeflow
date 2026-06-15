$EnvFile = "backend\.env.docker"
$Example = "backend\.env.docker.example"

if (-not (Test-Path $EnvFile)) {
    Copy-Item $Example $EnvFile
    Write-Host "Created $EnvFile from example -- edit it before re-running."
    exit 1
}

docker compose -f docker/docker-compose.yml --env-file $EnvFile up -d --build

$webPort = if ($env:WEB_PORT) { $env:WEB_PORT } else { "3000" }
$apiPort = if ($env:API_PORT) { $env:API_PORT } else { "8000" }
Write-Host "TypeFlow is up. Frontend -> http://localhost:$webPort  API -> http://localhost:$apiPort"
