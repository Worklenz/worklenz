# Worklenz - React Frontend

Worklenz is a project management application built with React, TypeScript, and Ant Design. The project is bundled using [Vite](https://vitejs.dev/).

## Table of Contents

- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Learn More](#learn-more)
- [License](#license)

## Getting Started

To get started with the project, follow these steps:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Worklenz/worklenz.git
   ```
2. **Navigate to the project directory**:
   ```bash
   cd worklenz/worklenz-frontend
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start the development server**:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:5000](http://localhost:5000) in your browser to view the application.

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in the development mode.\
Open [http://localhost:5000](http://localhost:5000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `dist` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

### `npm run preview`

Serves the production build locally for testing.\
Open [http://localhost:4173](http://localhost:4173) to preview the build.

## Project Structure

The project is organized around a feature-based structure:

```
src/
├── components/        # Reusable UI components
├── hooks/             # Custom React hooks
├── lib/               # Feature-specific logic
├── pages/             # Route components
├── services/          # API services
├── shared/            # Shared utilities, constants, and types
├── store/             # Global state management
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── App.tsx            # Main application component
└── main.tsx           # Application entry point
```

## Contributing

Contributions are welcome! If you'd like to contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/YourFeatureName`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/YourFeatureName`).
5. Open a pull request.

## Learn More

To learn more about the technologies used in this project:

- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Ant Design Documentation](https://ant.design/docs/react/introduce)
- [Vite Documentation](https://vitejs.dev/guide/)

## License

Worklenz is open source and released under the [GNU Affero General Public License Version 3 (AGPLv3)](LICENSE).
