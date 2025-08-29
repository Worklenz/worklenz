# Worklenz Client Portal - Nginx Production Deployment

This guide covers deploying the Worklenz Client Portal to production using nginx.

## Prerequisites

- Ubuntu/Debian server with nginx installed
- Node.js and npm installed
- SSL certificate for `clients.worklenz.com`
- Backend API server running (if applicable)

## Files Created

1. `nginx-clients-worklenz.conf` - Nginx configuration block
2. `deploy-client-portal.sh` - Automated deployment script
3. `CLIENT_PORTAL_DEPLOYMENT.md` - This deployment guide

## Quick Deployment

### Option 1: Automated Deployment (Recommended)

```bash
# Make the script executable
chmod +x deploy-client-portal.sh

# Run the deployment script as root
sudo ./deploy-client-portal.sh
```

### Option 2: Manual Deployment

1. **Build the application:**
   ```bash
   cd worklenz-client-portal
   npm install
   npm run build
   cd ..
   ```

2. **Create web directory:**
   ```bash
   sudo mkdir -p /var/www/clients.worklenz.com
   sudo cp -r worklenz-client-portal/dist/* /var/www/clients.worklenz.com/
   sudo chown -R www-data:www-data /var/www/clients.worklenz.com
   sudo chmod -R 755 /var/www/clients.worklenz.com
   ```

3. **Install nginx configuration:**
   ```bash
   sudo cp nginx-clients-worklenz.conf /etc/nginx/sites-available/clients.worklenz.com
   sudo ln -sf /etc/nginx/sites-available/clients.worklenz.com /etc/nginx/sites-enabled/
   ```

4. **Test and reload nginx:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

## Configuration Customization

### SSL Certificate Setup

Update the SSL certificate paths in the nginx configuration:

```nginx
ssl_certificate /path/to/your/ssl/certificate.crt;
ssl_certificate_key /path/to/your/ssl/private.key;
```

### Backend API Configuration

If your client portal needs to communicate with a backend API, update the proxy settings:

```nginx
location /api/ {
    proxy_pass http://your-backend-server:port/;
    # ... other proxy settings
}
```

### Environment Variables

The client portal may need environment variables. Create a `.env` file in the `worklenz-client-portal` directory before building:

```bash
# Example environment variables
VITE_API_BASE_URL=https://api.worklenz.com
VITE_APP_ENV=production
```

## Features Included

### Security
- HTTPS redirect
- Security headers (X-Frame-Options, CSP, etc.)
- Hidden file protection
- SSL/TLS configuration

### Performance
- Gzip compression
- Static asset caching (1 year for assets, 1 hour for HTML)
- HTTP/2 support

### SPA Support
- Client-side routing support with `try_files`
- Proper handling of React Router

### Monitoring
- Access and error logging
- Health check endpoint at `/health`

## Troubleshooting

### Common Issues

1. **SSL Certificate Errors:**
   - Ensure SSL certificate paths are correct
   - Check certificate validity and permissions

2. **404 Errors on Routes:**
   - Verify `try_files $uri $uri/ /index.html;` is present
   - Check that `index.html` exists in the web root

3. **Permission Errors:**
   - Ensure nginx user has read access to web files
   - Check file ownership: `sudo chown -R www-data:www-data /var/www/clients.worklenz.com`

4. **API Proxy Issues:**
   - Verify backend server is running
   - Check proxy_pass URL is correct
   - Ensure firewall allows connections

### Logs

Check nginx logs for errors:
```bash
sudo tail -f /var/log/nginx/clients.worklenz.com.error.log
sudo tail -f /var/log/nginx/clients.worklenz.com.access.log
```

### Testing

Test the configuration:
```bash
sudo nginx -t
```

Test the site:
```bash
curl -I https://clients.worklenz.com
```

## Maintenance

### Updating the Application

1. Pull latest changes
2. Rebuild the application
3. Copy new files to web directory
4. Reload nginx

```bash
cd worklenz-client-portal
git pull
npm install
npm run build
sudo cp -r dist/* /var/www/clients.worklenz.com/
sudo systemctl reload nginx
```

### SSL Certificate Renewal

If using Let's Encrypt:
```bash
sudo certbot renew --nginx
sudo systemctl reload nginx
```

## File Structure

```
/var/www/clients.worklenz.com/
├── index.html
├── favicon.ico
├── manifest.json
├── vite.svg
└── assets/
    ├── index-*.js
    ├── index-*.css
    └── *.png
```

## Support

For issues related to:
- **Nginx configuration**: Check nginx logs and configuration syntax
- **Application build**: Check Node.js/npm versions and dependencies
- **SSL certificates**: Verify certificate paths and validity
- **Domain/DNS**: Ensure DNS records point to your server

## Security Notes

- Keep nginx and system packages updated
- Regularly review and update security headers
- Monitor access logs for suspicious activity
- Use strong SSL/TLS configurations
- Consider implementing rate limiting for additional security
