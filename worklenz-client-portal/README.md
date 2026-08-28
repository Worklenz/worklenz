# Worklenz Client Portal

A separate React Vite application for the Worklenz client portal, built with modern technologies and best practices.

## Features

- **Modern Tech Stack**: React 18, TypeScript, Vite, Ant Design
- **State Management**: Redux Toolkit with RTK Query for efficient data fetching
- **Routing**: React Router v6 with protected routes
- **UI Framework**: Ant Design with dark/light theme support
- **Type Safety**: Full TypeScript implementation
- **Responsive Design**: Mobile-first approach
- **Authentication**: Client token-based authentication

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── layout/         # Layout components
│   ├── dashboard/      # Dashboard-specific components
│   ├── services/       # Services components
│   ├── requests/       # Request components
│   ├── projects/       # Project components
│   ├── invoices/       # Invoice components
│   ├── settings/       # Settings components
├── pages/              # Page components
├── store/              # Redux store configuration
│   ├── api.ts         # RTK Query API slice
│   ├── slices/        # Redux slices
├── hooks/              # Custom React hooks
├── services/           # API services
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── styles/             # Global styles
└── assets/             # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
# Create .env file with your API configuration
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=Worklenz Client Portal
VITE_CLIENT_PORTAL=true
```

3. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3001`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## API Integration

The client portal uses RTK Query for efficient data fetching and caching. All API endpoints are defined in `src/store/api.ts` and include:

- **Dashboard**: Statistics and overview data
- **Services**: Available services listing
- **Requests**: Service request management
- **Projects**: Project tracking and details
- **Invoices**: Invoice management and payments
- **Chats**: Real-time communication
- **Settings**: User preferences and configuration
- **Profile**: User profile management
- **Notifications**: System notifications

## Authentication

The client portal uses a token-based authentication system:

1. Clients receive a unique token for accessing the portal
2. Token is stored in localStorage and included in API requests
3. Protected routes automatically redirect to login if not authenticated
4. Token expiration is handled gracefully

## Theme Support

The application supports both light and dark themes:

- Theme preference is stored in localStorage
- Automatic theme switching via user menu
- Consistent styling across all components

## Development

### Adding New Pages

1. Create a new page component in `src/pages/`
2. Add the route to `src/App.tsx`
3. Add menu item to `src/components/layout/ClientLayout.tsx`

### Adding New API Endpoints

1. Add the endpoint to `src/store/api.ts`
2. Export the generated hooks
3. Use the hooks in your components

### Styling

- Use Ant Design components for consistency
- Follow the design system tokens
- Support both light and dark themes
- Use CSS-in-JS or SCSS for custom styles

## Deployment

### Docker

```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Variables

- `VITE_API_BASE_URL`: Backend API URL
- `VITE_APP_NAME`: Application name
- `VITE_CLIENT_PORTAL`: Flag to identify client portal

## Contributing

1. Follow the existing code structure
2. Use TypeScript for all new code
3. Add proper error handling
4. Include loading states
5. Test on both light and dark themes
6. Ensure responsive design

## License

This project is part of the Worklenz open-source project.
