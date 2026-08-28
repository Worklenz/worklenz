# Apply Client Portal Database Migrations
# This script applies all necessary migrations for the Client Portal feature

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Client Portal Migration Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Database connection details from .env
$DB_USER = "postgres"
$DB_PASSWORD = "postgres@123"
$DB_NAME = "worklenz_db"
$DB_HOST = "localhost"
$DB_PORT = "5432"

# Set PGPASSWORD environment variable to avoid password prompt
$env:PGPASSWORD = $DB_PASSWORD

Write-Host "Database Configuration:" -ForegroundColor Yellow
Write-Host "  Host: $DB_HOST" -ForegroundColor Gray
Write-Host "  Port: $DB_PORT" -ForegroundColor Gray
Write-Host "  Database: $DB_NAME" -ForegroundColor Gray
Write-Host "  User: $DB_USER" -ForegroundColor Gray
Write-Host ""

# Check if psql is available
Write-Host "Checking psql availability..." -ForegroundColor Yellow
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "ERROR: psql command not found!" -ForegroundColor Red
    Write-Host "Please install PostgreSQL and ensure psql is in your PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "You can also run the migrations manually:" -ForegroundColor Yellow
    Write-Host "  psql -U $DB_USER -d $DB_NAME -f database/migrations/apply-client-portal-migrations.sql" -ForegroundColor Gray
    exit 1
}

Write-Host "psql found at: $($psqlPath.Source)" -ForegroundColor Green
Write-Host ""

# Test database connection
Write-Host "Testing database connection..." -ForegroundColor Yellow
$connectionTest = psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -c "SELECT 1" -t 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cannot connect to database!" -ForegroundColor Red
    Write-Host "Error: $connectionTest" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  1. PostgreSQL is running" -ForegroundColor Gray
    Write-Host "  2. Database credentials are correct" -ForegroundColor Gray
    Write-Host "  3. Database '$DB_NAME' exists" -ForegroundColor Gray
    exit 1
}

Write-Host "Database connection successful!" -ForegroundColor Green
Write-Host ""

# Check if client_users table already exists
Write-Host "Checking if client_users table exists..." -ForegroundColor Yellow
$tableCheck = psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_users');" -t 2>&1
if ($tableCheck -match "t") {
    Write-Host "WARNING: client_users table already exists!" -ForegroundColor Yellow
    Write-Host "Migrations may have already been applied." -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Do you want to continue anyway? (y/n)"
    if ($response -ne "y") {
        Write-Host "Migration cancelled." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Applying Migrations..." -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Run the migrations
Push-Location "$PSScriptRoot\.."
$migrationsPath = "database\migrations\apply-client-portal-migrations.sql"

if (-not (Test-Path $migrationsPath)) {
    Write-Host "ERROR: Migration file not found: $migrationsPath" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "Running migrations from: $migrationsPath" -ForegroundColor Yellow
Write-Host ""

psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -f $migrationsPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "Migrations Applied Successfully!" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "The client portal forgot password feature should now work." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Restart the backend server" -ForegroundColor Gray
    Write-Host "  2. Test the forgot password functionality" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host "Migration Failed!" -ForegroundColor Red
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check the error messages above." -ForegroundColor Yellow
    Write-Host "You may need to fix issues and re-run the script." -ForegroundColor Yellow
}

Pop-Location

# Clear password from environment
$env:PGPASSWORD = $null
