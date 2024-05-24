# Run App on Docker

Getting started with docker is a breeze! Follow these steps and you'll be contributing in no time.

## Requirements

- Docker v26 or newer - [Docker](https://www.docker.com/)

## Installation

**Clone the repository**

   ```bash
   git clone https://github.com/Worklenz/worklenz.git
   ```

### Use Docker Compose

1. **Navigate to the project directory**
  
    ```bash
      cd worklenz
    ```

2. **Run Compose in detach mode**

    ```bash
      docker compose up -d
    ```

3. **Database Migration (Manual)**

    ```bash
      docker compose exec backend bash
    ```

    You should have bash access to backend container. To test connection to db and check for current active db.

    ```bash
      PGPASSWORD=worklenz_password psql -h db -U worklenz_user -d worklenz_db
      SELECT current_database();
    ```

    If you have an output from the db, you can start running the migrations (one command at a time).

    ```bash
      PGPASSWORD=worklenz_password psql -h db -U worklenz_user -d worklenz_db -f 1_tables.sql
      PGPASSWORD=worklenz_password psql -h db -U worklenz_user -d worklenz_db -f 2_triggers.sql
      PGPASSWORD=worklenz_password psql -h db -U worklenz_user -d worklenz_db -f 3_system-data.sql
      PGPASSWORD=worklenz_password psql -h db -U worklenz_user -d worklenz_db -f 4_views.sql
      PGPASSWORD=worklenz_password psql -h db -U worklenz_user -d worklenz_db -f 5_functions.sql
      PGPASSWORD=worklenz_password psql -h db -U worklenz_user -d worklenz_db -f 6_user-permission.sql
    ```

    and to verify

    ```bash
      \dt
    ```

    Exit and you are good to go.

    ```bash
      http://localhost:4200
    ```

    for frontend access

4. **Database Migration (Using PGAdmin)**

    ```bash
      http://localhost:5050
    ```

    for pgadmin access

    ```bash
      username - admin@worklenz.com
      password - worklenz_password
    ```

    Add a connection using db access details and run the *.sql files.
