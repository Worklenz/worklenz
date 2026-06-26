# Apply Database Migration for Task Activity Logs Fix
# This script applies the migration to fix the CASCADE delete issue

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Task Activity Logs Migration" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This migration will:" -ForegroundColor Yellow
Write-Host "  1. Allow task_id to be NULL in task_activity_logs"
Write-Host "  2. Change foreign key constraint from CASCADE to SET NULL"
Write-Host "  3. Preserve activity history when tasks are deleted"
Write-Host ""

# Check if we're in the backend directory
if (-not (Test-Path "database/migrations")) {
    Write-Host "ERROR: Please run this script from the worklenz-backend directory" -ForegroundColor Red
    exit 1
}

# Check for psql
$psqlExists = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlExists) {
    Write-Host "ERROR: psql command not found. Please install PostgreSQL client tools." -ForegroundColor Red
    exit 1
}

Write-Host "Enter your database connection details:" -ForegroundColor Green
$dbHost = Read-Host "Database Host (default: localhost)"
if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "localhost" }

$dbPort = Read-Host "Database Port (default: 5432)"
if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "5432" }

$dbName = Read-Host "Database Name (default: worklenz)"
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "worklenz" }

$dbUser = Read-Host "Database User (default: postgres)"
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "postgres" }

Write-Host ""
Write-Host "Applying migration..." -ForegroundColor Yellow

$migrationFile = "database/migrations/20260222000000-fix-task-activity-logs-cascade-delete.sql"

$env:PGPASSWORD = Read-Host "Database Password" -AsSecureString | ConvertFrom-SecureString -AsPlainText

try {
    $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migrationFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Migration applied successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Changes made:" -ForegroundColor Cyan
        Write-Host "  • task_activity_logs.task_id now allows NULL values"
        Write-Host "  • Foreign key changed to ON DELETE SET NULL"
        Write-Host "  • Activity logs will be preserved when tasks are deleted"
        Write-Host "  • User 'Last Activity' will now update correctly on task deletion"
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Restart the backend server"
        Write-Host "  2. Test by creating and deleting a task"
        Write-Host "  3. Verify Last Activity updates in Admin Center > Users"
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "✗ Migration failed!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Error details:" -ForegroundColor Yellow
        Write-Host $result
        Write-Host ""
        Write-Host "Common issues:" -ForegroundColor Yellow
        Write-Host "  • Database connection failed - check credentials"
        Write-Host "  • Migration already applied - check if constraint already exists"
        Write-Host "  • Insufficient permissions - make sure user has ALTER TABLE rights"
    }
} catch {
    Write-Host ""
    Write-Host "✗ Error executing migration: $_" -ForegroundColor Red
} finally {
    $env:PGPASSWORD = $null
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
