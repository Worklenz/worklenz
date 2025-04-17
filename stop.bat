@echo off
echo [91mStopping Worklenz Docker Environment...[0m

REM Stop the containers
docker-compose down

echo [92mWorklenz services have been stopped.[0m 