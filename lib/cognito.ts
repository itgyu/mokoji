import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID || '',
  ClientId: process.env.NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID || '',
};

const userPool = new CognitoUserPool(poolData);

export interface CognitoAuthUser {
  email: string;
  name: string;
  sub: string; // Cognito User ID
  email_verified: boolean;
}

/**
 * 이메일/비밀번호로 로그인
 */
export const signInWithEmail = (
  email: string,
  password: string
): Promise<{ user: CognitoAuthUser; session: CognitoUserSession }> => {
  return new Promise((resolve, reject) => {
    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        const idToken = session.getIdToken();
        const payload = idToken.payload;

        resolve({
          user: {
            email: payload.email,
            name: payload.name || email.split('@')[0],
            sub: payload.sub,
            email_verified: payload.email_verified || false,
          },
          session,
        });
      },
      onFailure: (err) => {
        reject(err);
      },
      newPasswordRequired: (userAttributes) => {
        // 임시 비밀번호 사용 시 새 비밀번호 필요
        reject(new Error('NEW_PASSWORD_REQUIRED'));
      },
    });
  });
};

/**
 * 로그아웃
 */
export const signOut = (): Promise<void> => {
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    resolve();
  });
};

/**
 * 현재 로그인된 사용자 가져오기
 */
export const getCurrentUser = (): Promise<CognitoAuthUser | null> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) {
        resolve(null);
        return;
      }

      if (!session.isValid()) {
        resolve(null);
        return;
      }

      const idToken = session.getIdToken();
      const payload = idToken.payload;

      resolve({
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        sub: payload.sub,
        email_verified: payload.email_verified || false,
      });
    });
  });
};

/**
 * 현재 세션 가져오기
 */
export const getCurrentSession = (): Promise<CognitoUserSession | null> => {
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) {
        resolve(null);
        return;
      }

      if (!session.isValid()) {
        resolve(null);
        return;
      }

      resolve(session);
    });
  });
};

/**
 * ID 토큰 가져오기 (API 호출 시 사용)
 */
export const getIdToken = async (): Promise<string | null> => {
  const session = await getCurrentSession();
  if (!session) return null;
  return session.getIdToken().getJwtToken();
};

/**
 * 비밀번호 재설정 요청
 */
export const forgotPassword = (email: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.forgotPassword({
      onSuccess: () => {
        resolve();
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
};

/**
 * 비밀번호 재설정 확인
 */
export const confirmPassword = (
  email: string,
  verificationCode: string,
  newPassword: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.confirmPassword(verificationCode, newPassword, {
      onSuccess: () => {
        resolve();
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
};

/**
 * 회원가입 (이메일 인증 필요)
 */
export const signUp = (
  email: string,
  password: string,
  name: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const attributeList = [
      new CognitoUserAttribute({
        Name: 'email',
        Value: email,
      }),
      new CognitoUserAttribute({
        Name: 'name',
        Value: name,
      }),
    ];

    userPool.signUp(email, password, attributeList, [], (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
};

/**
 * 이메일 인증 코드 확인
 */
export const confirmSignUp = (
  email: string,
  code: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.confirmRegistration(code, true, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
};

export { userPool };
