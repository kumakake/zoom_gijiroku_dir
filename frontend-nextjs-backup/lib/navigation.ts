  // BASE_PATH を使用した動的なナビゲーション設定

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  console.log('🔍 NAVIGATION DEBUG - NEXT_PUBLIC_BASE_PATH:', process.env.NEXT_PUBLIC_BASE_PATH);
  console.log('🔍 NAVIGATION DEBUG - basePath:', basePath);

  export const paths = {
    login:       '/login',
    dashboard:   '/dashboard',
    register:    '/register',
    profile:     '/profile',
    settings:    '/settings',
    transcripts: '/transcripts',
    jobs:        '/jobs',
    upload:      '/upload',
    debug:       '/debug',
  };

  // ナビゲーション用のヘルパー関数
  export const navigateToLogin = (router: any) => {
    router.push(paths.login);
  };

  export const navigateToProfile = (router: any) => {
    router.push(paths.profile);
  };
