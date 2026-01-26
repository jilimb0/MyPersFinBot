/**
 * PM2 Ecosystem Configuration
 * 
 * Usage:
 *   Production: pm2 start ecosystem.config.js --env production
 *   Development: pm2 start ecosystem.config.js --env development
 *   Restart: pm2 restart my-pers-fin-bot
 *   Stop: pm2 stop my-pers-fin-bot
 *   Logs: pm2 logs my-pers-fin-bot
 *   Monitor: pm2 monit
 */

module.exports = {
  apps: [
    {
      // Application name
      name: 'my-pers-fin-bot',
      
      // Script to run
      script: './dist/index.js',
      
      // Instances
      instances: 1,
      exec_mode: 'fork', // or 'cluster' for multiple instances
      
      // Auto restart
      autorestart: true,
      watch: false, // Don't watch in production
      max_memory_restart: '1G',
      
      // Error handling
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Log rotation (requires pm2-logrotate)
      // pm2 install pm2-logrotate
      log_type: 'json',
      
      // Environment variables - Production
      env_production: {
        NODE_ENV: 'production',
        // Add your production env vars here
        // TELEGRAM_BOT_TOKEN will be read from .env
      },
      
      // Environment variables - Development
      env_development: {
        NODE_ENV: 'development',
        // Add your development env vars here
      },
      
      // Kill timeout
      kill_timeout: 5000,
      
      // Listen timeout
      listen_timeout: 3000,
      
      // Wait for ready
      wait_ready: false,
      
      // Graceful shutdown
      shutdown_with_message: true,
    },
  ],
  
  // Deploy configuration (optional)
  deploy: {
    production: {
      // SSH connection
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/MyPersFinBot.git',
      path: '/var/www/my-pers-fin-bot',
      
      // Pre-deploy
      'pre-deploy-local': '',
      
      // Post-deploy
      'post-deploy':
        'pnpm install && pnpm build && pm2 reload ecosystem.config.js --env production',
      
      // Pre-setup
      'pre-setup': '',
      
      // SSH options
      ssh_options: 'StrictHostKeyChecking=no',
    },
  },
}
