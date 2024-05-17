# Setting up development environment

Getting started with development is a breeze! Follow these steps and you'll be contributing in no time.

## Requirements

- Node.js version v18 or newer - [Node.js](https://nodejs.org/en/download/current)
- Postgres version v15.6 - [PostgreSQL](https://www.postgresql.org/download/)
- Redis version v4.6.7 (not used yet. setup only.)

## Prerequisites

- `$ npm install -g ts-node`
- `$ npm install -g typescript`
- `$ npm install -g grunt grunt-cli`

## Installation
**Clone the repository:**

   ```bash
   git clone https://github.com/Worklenz/worklenz.git
   ```

### Frontend installation

1. **Navigate to the frontend project directory:**

   ```bash
   cd worklenz-frontend
   ```
2. **Install dependencies:**

   ```bash
   npm install
   
3. **Run the frontend:**
   ```bash
   npm start
   ```
   
4. Navigate to [http://localhost:4200](http://localhost:4200)

### Backend installation
   
1. **Navigate to the backend project directory:**

   ```bash
   cd worklenz-backend
   ```

2. **Open your IDE:**

   Open the project directory in your preferred code editor or IDE like Visual Studio Code.

3. **Configure Environment Variables:**

   - Create a copy of the `.env.template` file and name it `.env`.
   - Update the required fields in `.env` with the specific information.

4. **Restore Database**
   - Create a new database named `worklenz_db` on your local PostgreSQL server. 
   - Update the `DATABASE_NAME` and `PASSWORD` in the  `database/6_user_permission.sql` with your DB credentials.
   - Open a query console and execute the queries from the .sql files in the `database` directories, following the provided order.

5. **Install Dependencies:**

   ```bash
   npm install
   ```

   This command installs all the necessary libraries required to run the project.

6. **Run the Development Server:**

   **a. Start the TypeScript compiler:**

   Open a new terminal window and run the following command:

      ```bash
      grunt dev
      ```

   This starts the `grunt` task runner, which compiles TypeScript code into JavaScript.

   **b. Start the development server:**

   Open another separate terminal window and run the following command:

      ```bash
      npm start
      ```

   This starts the development server allowing you to work on the project.

7. **Run the Production Server:**

   **a. Compile TypeScript to JavaScript:**

   Open a new terminal window and run the following command:

      ```bash
      grunt build
      ```

   This starts the `grunt` task runner, which compiles TypeScript code into JavaScript for production use.

   **b. Start the production server:**

   Once the compilation is complete, run the following command in the same terminal window:

      ```bash
      npm start
      ```

   This starts the production server for your application.
