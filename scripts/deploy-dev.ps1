param(
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$')]
    [string]$Tag = "dev-$(Get-Date -Format yyyyMMddHHmmss)"
)

$ErrorActionPreference = 'Stop'
$Project = 'bakerrang-dev'
$Region = 'us-west1'
$ApiService = 'bakerrang-api-dev'
$PortalService = 'bakerrang-portal-dev'
$RendererService = 'bakerrang-site-renderer-dev'

$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$ServerPath = Join-Path $RepositoryRoot 'server'
$PlatformPath = Join-Path $RepositoryRoot 'platform'

function Assert-NativeSuccess {
    param([Parameter(Mandatory)][string]$Operation)
    if ($LASTEXITCODE -ne 0) {
        throw "$Operation failed with exit code $LASTEXITCODE."
    }
}

function Get-ImageRepository {
    param([Parameter(Mandatory)][string]$Service)

    $Current = (& gcloud run services describe $Service `
        --project $Project `
        --region $Region `
        --format 'value(spec.template.spec.containers[0].image)' | Out-String).Trim()
    Assert-NativeSuccess "Reading Cloud Run service $Service"

    if ([string]::IsNullOrWhiteSpace($Current)) {
        throw "Cloud Run service $Service returned no image reference."
    }

    $Repository = $Current -replace '(@sha256:[A-Fa-f0-9]+|:[^/:]+)$', ''
    if ([string]::IsNullOrWhiteSpace($Repository) -or $Repository -eq $Current -or $Repository -notmatch '^[^/]+/.+/.+$') {
        throw "Unable to derive an image repository from service $Service."
    }
    return $Repository
}

foreach ($RequiredPath in @(
    (Join-Path $ServerPath 'Dockerfile'),
    (Join-Path $PlatformPath 'apps/portal/Dockerfile'),
    (Join-Path $PlatformPath 'apps/site-renderer/Dockerfile')
)) {
    if (-not (Test-Path -LiteralPath $RequiredPath -PathType Leaf)) {
        throw "Required deployment file not found: $RequiredPath"
    }
}

Write-Host "Preparing BakerRang DEV images with tag: $Tag"

$ApiImage = "$(Get-ImageRepository $ApiService):$Tag"
$PortalImage = "$(Get-ImageRepository $PortalService):$Tag"
$RendererImage = "$(Get-ImageRepository $RendererService):$Tag"

Write-Host "API image:      $ApiImage"
Write-Host "Portal image:   $PortalImage"
Write-Host "Renderer image: $RendererImage"

$RegistryHosts = @($ApiImage, $PortalImage, $RendererImage) |
    ForEach-Object { ($_ -split '/', 2)[0] } |
    Sort-Object -Unique

foreach ($RegistryHost in $RegistryHosts) {
    & gcloud auth configure-docker $RegistryHost --quiet
    Assert-NativeSuccess "Configuring Docker authentication for $RegistryHost"
}

Push-Location $ServerPath
try {
    & docker build -t $ApiImage .
    Assert-NativeSuccess 'Building API image'
} finally {
    Pop-Location
}

Push-Location $PlatformPath
try {
    & docker build -f apps/portal/Dockerfile `
        --build-arg NEXT_PUBLIC_API_BASE_URL=https://api-dev.bakerrang.com `
        --build-arg NEXT_PUBLIC_SITE_PREVIEW_ORIGIN=https://sites-dev.bakerrang.com `
        --build-arg CUSTOM_DOMAIN_IPV4_ADDRESS=8.232.231.135 `
        -t $PortalImage .
    Assert-NativeSuccess 'Building Portal image'

    & docker build -f apps/site-renderer/Dockerfile `
        --build-arg NEXT_PUBLIC_SITE_API_BASE_URL=https://api-dev.bakerrang.com `
        -t $RendererImage .
    Assert-NativeSuccess 'Building Renderer image'
} finally {
    Pop-Location
}

foreach ($Image in @($ApiImage, $PortalImage, $RendererImage)) {
    & docker push $Image
    Assert-NativeSuccess "Pushing image $Image"
}

foreach ($Deployment in @(
    @{ Service = $ApiService; Image = $ApiImage },
    @{ Service = $PortalService; Image = $PortalImage },
    @{ Service = $RendererService; Image = $RendererImage }
)) {
    & gcloud run services update $($Deployment.Service) `
        --project $Project `
        --region $Region `
        --image $($Deployment.Image) `
        --quiet
    Assert-NativeSuccess "Updating Cloud Run service $($Deployment.Service)"
    Write-Host "Updated $($Deployment.Service) successfully."
}

Write-Host ''
Write-Host 'DEV deployment complete. Verify:'
Write-Host '  API health: https://api-dev.bakerrang.com/health'
Write-Host '  Portal:     https://portal-dev.bakerrang.com'
Write-Host '  Sites:      https://sites-dev.bakerrang.com'
Write-Host '  Custom:     https://custom-dev.bakerrang.com'
Write-Host ''
Write-Host 'API project log:'
Write-Host '  gcloud run services logs read bakerrang-api-dev --project bakerrang-dev --region us-west1 --limit 100'
