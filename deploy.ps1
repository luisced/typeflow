$EnvFile = ".env"
$Example = ".env.example"

if (-not (Test-Path $EnvFile)) {
    Copy-Item $Example $EnvFile
    Write-Host "Created $EnvFile from example -- edit it before re-running."
    exit 1
}

# Read a var from the env file — active line takes priority, then commented line.
function Read-EnvVar($key, $default) {
    $lines = Get-Content $EnvFile
    $active = $lines | Where-Object { $_ -match "^${key}=(.+)" } | Select-Object -Last 1
    if ($active -match "^${key}=(.+)") { return $Matches[1].Trim() }
    $commented = $lines | Where-Object { $_ -match "^#\s*${key}=(.+)" } | Select-Object -Last 1
    if ($commented -match "^#\s*${key}=(.+)") { return $Matches[1].Trim() }
    return $default
}

$ApiPort = Read-EnvVar "API_PORT" "8000"
$WebPort = Read-EnvVar "WEB_PORT" "3000"

function Test-PortInUse($port) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $connections
}

if (Test-PortInUse $ApiPort) {
    Write-Host "Error: port $ApiPort (API_PORT) is already in use."
    Write-Host "Set API_PORT=$ApiPort in $EnvFile (uncomment the line) and change it, then re-run."
    exit 1
}

if (Test-PortInUse $WebPort) {
    Write-Host "Error: port $WebPort (WEB_PORT) is already in use."
    Write-Host "Set WEB_PORT=$WebPort in $EnvFile (uncomment the line) and change it, then re-run."
    exit 1
}

docker compose -f docker/docker-compose.yml --env-file $EnvFile `
    -e API_PORT=$ApiPort -e WEB_PORT=$WebPort `
    up -d --build
Write-Host "TypeFlow is up. Frontend -> http://localhost:$WebPort  API -> http://localhost:$ApiPort"
