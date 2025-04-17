@echo off
echo.
echo " __          __        _    _"                
echo " \ \        / /       | |  | |"               
echo "  \ \  /\  / /__  _ __| | _| | ___ _ __  ____"
echo "   \ \/  \/ / _ \| '__| |/ / |/ _ \ '_ \|_  /"
echo "    \  /\  / (_) | |  |   <| |  __/ | | |/ /" 
echo "     \/  \/ \___/|_|  |_|\_\_|\___|_| |_/___|"
echo.
echo          W O R K L E N Z                     
echo.
echo Starting Worklenz Docker Environment...
echo.

REM Check if .env file exists
IF NOT EXIST .env (
    echo Warning: .env file not found. Using default configuration.
    IF EXIST .env.example (
        copy .env.example .env
        echo Created .env file from .env.example
    )
)

REM Stop any running containers
docker-compose down

REM Start the containers
docker-compose up -d

REM Wait for services to be ready
echo Waiting for services to start...
timeout /t 5 /nobreak > nul

REM Check if services are running
docker ps | findstr "worklenz_frontend" > nul
IF %ERRORLEVEL% EQU 0 (
    echo [92m^✓[0m Frontend is running
    echo    Frontend URL: http://localhost:5000
) ELSE (
    echo [91m^✗[0m Frontend service failed to start
)

docker ps | findstr "worklenz_backend" > nul
IF %ERRORLEVEL% EQU 0 (
    echo [92m^✓[0m Backend is running
    echo    Backend URL: http://localhost:3000
) ELSE (
    echo [91m^✗[0m Backend service failed to start
)

docker ps | findstr "worklenz_minio" > nul
IF %ERRORLEVEL% EQU 0 (
    echo [92m^✓[0m MinIO is running
    echo    MinIO Console URL: http://localhost:9001 (login: minioadmin/minioadmin)
) ELSE (
    echo [91m^✗[0m MinIO service failed to start
)

docker ps | findstr "worklenz_db" > nul
IF %ERRORLEVEL% EQU 0 (
    echo [92m^✓[0m Database is running
) ELSE (
    echo [91m^✗[0m Database service failed to start
)

echo.
echo [92mWorklenz is now running![0m
echo You can access the application at: http://localhost:5000
echo To stop the services, run: stop.bat 