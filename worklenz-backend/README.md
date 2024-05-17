# Worklenz Backend

1. **Open your IDE:**

   Open the project directory in your preferred code editor or IDE like Visual Studio Code.

2. **Configure Environment Variables:**

  - Create a copy of the `.env.template` file and name it `.env`.
  - Update the required fields in `.env` with the specific information.

3. **Restore Database**
  - Create a new database named `worklenz_db` on your local PostgreSQL server.
   - Update the `DATABASE_NAME` and `PASSWORD` in the  `database/6_user_permission.sql` with your DB credentials.
  - Open a query console and execute the queries from the .sql files in the `database` directories, following the provided order.

4. **Install Dependencies:**

   ```bash
   npm install
   ```

   This command installs all the necessary libraries required to run the project.

5. **Run the Development Server:**

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

6. **Run the Production Server:**

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

### CLI

- Create controller: `$ node new controller Test`
- Create angular release: `$ node new release`

### Developement Rules

- Controllers should only generate/create using the CLI (`node new controller Projects`)
- Validations should only be done using a middleware placed under src/validators/ and used inside the routers (E.g., api-router.ts)
- Validators should only generate/create using the CLI (`node new vaidator projects-params`)

## Pull submodules
- git submodule update --init --recursive
