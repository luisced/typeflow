$EnvFile = "backend\.env.docker"
$Example = "backend\.env.docker.example"

if (-not (Test-Path $EnvFile)) {
    Copy-Item $Example $EnvFile
    Write-Host "Created $EnvFile from example -- edit it before re-running."
    exit 1
}

# Read ports from env file, fall back to defaults
$ApiPort = (Select-String -Path $EnvFile -Pattern '^API_PORT=(.+)').Matches.Groups[1].Value.Trim()
$WebPort = (Select-String -Path $EnvFile -Pattern '^WEB_PORT=(.+)').Matches.Groups[1].Value.Trim()
if (-not $ApiPort) { $ApiPort = "8000" }
if (-not $WebPort) { $WebPort = "3000" }

function Test-PortInUse($port) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $connections
}

if (Test-PortInUse $ApiPort) {
    Write-Host "Error: port $ApiPort (API_PORT) is already in use."
    Write-Host "Change API_PORT in $EnvFile and re-run."
    exit 1
}

if (Test-PortInUse $WebPort) {
    Write-Host "Error: port $WebPort (WEB_PORT) is already in use."
    Write-Host "Change WEB_PORT in $EnvFile and re-run."
    exit 1
}

docker compose -f docker/docker-compose.yml --env-file $EnvFile up -d --build
Write-Host "TypeFlow is up. Frontend -> http://localhost:$WebPort  API -> http://localhost:$ApiPort"
