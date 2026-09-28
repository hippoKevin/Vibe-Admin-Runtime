module.exports = {
    apps: [
      {
        name: 'main',
        script: 'dist/main.js',
        cwd: '/www/main',
        instances: 1,
        exec_mode: 'fork',
        env: {
          NODE_ENV: 'production',
          PORT: 5004,
        },
      },
    ],
  }