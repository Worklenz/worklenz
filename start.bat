@echo off
echo Starting Worklenz setup... > worklenz_startup.log
echo %DATE% %TIME% >> worklenz_startup.log
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

REM Check for Docker installation
echo Checking for Docker installation...
where docker >nul 2>>worklenz_startup.log
IF %ERRORLEVEL% NEQ 0 (
    echo [91mWarning: Docker is not installed or not in PATH[0m
    echo Warning: Docker is not installed or not in PATH >> worklenz_startup.log
    echo Please install Docker first: https://docs.docker.com/get-docker/
    echo [93mContinuing for debugging purposes...[0m
) ELSE (
    echo [92m^✓[0m Docker is installed
    echo Docker is installed >> worklenz_startup.log
)

REM Check for docker-compose installation
echo Checking for docker-compose...
where docker-compose >nul 2>>worklenz_startup.log
IF %ERRORLEVEL% NEQ 0 (
    echo [91mWarning: docker-compose is not installed or not in PATH[0m
    echo Warning: docker-compose is not installed or not in PATH >> worklenz_startup.log
    echo [93mContinuing for debugging purposes...[0m
) ELSE (
    echo [92m^✓[0m docker-compose is installed
    echo docker-compose is installed >> worklenz_startup.log
)

REM Check for update-docker-env.sh
IF EXIST update-docker-env.sh (
    echo [94mFound update-docker-env.sh script. You can use it to update environment variables.[0m
    echo Found update-docker-env.sh script >> worklenz_startup.log
)

REM Run preflight checks
echo Running Docker daemon check...
docker info >nul 2>>worklenz_startup.log
IF %ERRORLEVEL% NEQ 0 (
    echo [91mWarning: Docker daemon is not running[0m
    echo Warning: Docker daemon is not running >> worklenz_startup.log
    echo Please start Docker and try again
    echo [93mContinuing for debugging purposes...[0m
) ELSE (
    echo [92m^✓[0m Docker daemon is running
    echo Docker daemon is running >> worklenz_startup.log
)

REM Stop any running containers
echo Stopping any running containers...
docker-compose down > nul 2>>worklenz_startup.log
IF %ERRORLEVEL% NEQ 0 (
    echo [91mWarning: Error stopping containers[0m
    echo Warning: Error stopping containers >> worklenz_startup.log
    echo [93mContinuing anyway...[0m
)

REM Start the containers
echo Starting containers...
echo Attempting to start containers... >> worklenz_startup.log

REM Start with docker-compose
docker-compose up -d > docker_up_output.txt 2>&1
type docker_up_output.txt >> worklenz_startup.log

REM Check for errors in output
findstr /C:"Error" docker_up_output.txt > nul
IF %ERRORLEVEL% EQU 0 (
    echo [91mErrors detected during startup[0m
    echo Errors detected during startup >> worklenz_startup.log
    type docker_up_output.txt
)

del docker_up_output.txt > nul 2>&1

REM Wait for services to be ready
echo Waiting for services to start...
timeout /t 10 /nobreak > nul
echo After timeout, checking services >> worklenz_startup.log

REM Check service status using docker-compose
echo Checking service status...
echo Checking service status... >> worklenz_startup.log
docker-compose ps --services --filter "status=running" > running_services.txt 2>>worklenz_startup.log

REM Log services output
type running_services.txt >> worklenz_startup.log

echo.
echo Checking individual services:
echo Checking individual services: >> worklenz_startup.log

REM Check frontend
findstr /C:"frontend" running_services.txt > nul
IF %ERRORLEVEL% EQU 0 (
    echo [92m^✓[0m Frontend is running
    echo    Frontend URL: http://localhost:5000 (or https://localhost:5000 if SSL is enabled)
    echo Frontend is running >> worklenz_startup.log
) ELSE (
    echo [91m^✗[0m Frontend service failed to start
    echo Frontend service failed to start >> worklenz_startup.log
)

REM Check backend
findstr /C:"backend" running_services.txt > nul
IF %ERRORLEVEL% EQU 0 (
    echo [92m^✓[0m Backend is running
    echo    Backend URL: http://localhost:3000 (or https://localhost:3000 if SSL is enabled)
    echo Backend is running >> worklenz_startup.log
) ELSE (
    echo [91m^✗[0m Backend service failed to start
    echo Backend service failed to start >> worklenz_startup.log
)

REM Check MinIO
findstr /C:"minio" running_services.txt > nul
IF %ERRORLEVEL% EQU 0 (
    echo [92m^✓[0m MinIO is running
    echo    MinIO Console URL: http://localhost:9001 (login: minioadmin/minioadmin)
    echo MinIO is running >> worklenz_startup.log
) ELSE (
    echo [91m^✗[0m MinIO service failed to start
    echo MinIO service failed to start >> worklenz_startup.log

    REM Check MinIO logs
    echo Checking MinIO logs for errors:
    docker-compose logs minio --tail=20 > minio_logs.txt
    type minio_logs.txt
    type minio_logs.txt >> worklenz_startup.log
    del minio_logs.txt > nul 2>&1
)

REM Check Database
findstr /C:"db" running_services.txt > nul
IF %ERRORLEVEL% EQU 0 (
    echo [92m^✓[0m Database is running
    echo Database is running >> worklenz_startup.log
) ELSE (
    echo [91m^✗[0m Database service failed to start
    echo Database service failed to start >> worklenz_startup.log
)

del running_services.txt > nul 2>&1

REM Check if all services are running
set allRunning=1
docker-compose ps --services | findstr /V /C:"frontend" /C:"backend" /C:"minio" /C:"db" > remaining_services.txt
FOR /F "tokens=*" %%s IN (remaining_services.txt) DO (
    findstr /C:"%%s" running_services.txt > nul || set allRunning=0
)
del remaining_services.txt > nul 2>&1

IF %allRunning% EQU 1 (
    echo.
    echo [92mWorklenz setup completed![0m
    echo Setup completed successfully >> worklenz_startup.log
) ELSE (
    echo.
    echo [93mWarning: Some services may not be running correctly.[0m
    echo Warning: Some services may not be running correctly >> worklenz_startup.log
    echo Run 'docker-compose logs' to check for errors.
)

echo You can access the application at: http://localhost:5000
echo To stop the services, run: stop.bat
echo To update environment variables, run: update-docker-env.sh
echo.
echo Note: To enable SSL, set ENABLE_SSL=true in your .env file and run update-docker-env.sh
echo.
echo For any errors, check worklenz_startup.log file
echo.
echo Press any key to exit...
pause > nul 