module.exports = {
    apps : {
        name: 'boostrep',
        script: './bin/www',
        args: 'one two',
        instances: 0,
        instance_var: 'INSTANCE_ID',
        autorestart: true,
        watch: true,
        ignore_watch: ["node_modules", "public", "uploads"],
        env: {
            version: 1.0,
            NODE_ENV: 'development',
            PORT:3030,
            TZ: 'Asia/Seoul',
            secret: 'BoosterSecret@@@$$',
            DB_HOST: 'kooktoo-db.cvd4rqysi3gj.ap-northeast-2.rds.amazonaws.com',
            DB_USER: 'boostrap',
            DB_PASS: 'BsTRdb!@!',
            DB_PORT: 3306,
            DB_NAME: 'boostrap',
            API_HOST: 'http://localhost:3030',
        },
        env_production: {
            version: 1.0,
            NODE_ENV: 'production',
            PORT:3030,
            TZ: 'Asia/Seoul',
            secret: 'BoosterSecret@@@$$',
            DB_HOST: 'localhost',
            DB_USER: 'boostrep',
            DB_PASS: 'BsTRdb!@!',
            DB_PORT: 3306,
            DB_NAME: 'boostrep',
            API_HOST: 'https://api.boostrep.co.kr',
        }
    }
};
