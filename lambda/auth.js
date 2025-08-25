const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

exports.handler = async (event) => {
    const origin = event.headers?.origin || 'http://localhost:3000';
    const allowedOrigins = ['http://localhost:3000', 'https://ece4180.vercel.app'];
    const headers = {
        'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,PUT',
        'Access-Control-Allow-Credentials': 'true'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const { action } = event.pathParameters || {};
        const body = JSON.parse(event.body || '{}');

        switch (action) {
            case 'login':
                return await handleLogin(body);
            case 'register':
                return await handleRegister(body);
            case 'confirm':
                return await handleConfirmSignUp(body);
            case 'refresh':
                return await handleRefreshToken(body);
            case 'forgot-password':
                return await handleForgotPassword(body);
            case 'confirm-forgot-password':
                return await handleConfirmForgotPassword(body);
            case 'resend-verification':
                return await handleResendVerification(body);
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid action' })
                };
        }
    } catch (error) {
        console.error('Auth error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function handleLogin({ username, password }) {
    const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.USER_POOL_CLIENT_ID,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password
        }
    };

    try {
        const result = await cognito.initiateAuth(params).promise();
        
        // Get user attributes to include role information
        const userParams = {
            AccessToken: result.AuthenticationResult.AccessToken
        };
        const userInfo = await cognito.getUser(userParams).promise();
        
        const role = userInfo.UserAttributes.find(attr => attr.Name === 'custom:role')?.Value || 'student';
        const studentId = userInfo.UserAttributes.find(attr => attr.Name === 'custom:studentId')?.Value;

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            body: JSON.stringify({
                accessToken: result.AuthenticationResult.AccessToken,
                refreshToken: result.AuthenticationResult.RefreshToken,
                idToken: result.AuthenticationResult.IdToken,
                user: {
                    username: userInfo.Username,
                    role,
                    studentId
                }
            })
        };
    } catch (error) {
        console.error('Login error:', error);
        return {
            statusCode: 401,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
}

async function handleRegister({ username, password, email, role = 'student', studentId }) {
    // Validate email domain
    if (!email || !email.endsWith('@gatech.edu')) {
        console.error('Invalid email domain:', email);
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            body: JSON.stringify({ error: 'Only @gatech.edu email addresses are allowed' })
        };
    }

    const params = {
        ClientId: process.env.USER_POOL_CLIENT_ID,
        Username: username,
        Password: password,
        UserAttributes: [
            {
                Name: 'email',
                Value: email
            },
            {
                Name: 'custom:role',
                Value: role
            }
        ]
    };

    if (studentId) {
        params.UserAttributes.push({
            Name: 'custom:studentId',
            Value: studentId
        });
    }

    try {
        const result = await cognito.signUp(params).promise();
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            body: JSON.stringify({
                userSub: result.UserSub,
                message: 'User registered successfully. Please check your email for confirmation code.'
            })
        };
    } catch (error) {
        console.error('Registration error:', error);
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
}

async function handleConfirmSignUp({ username, confirmationCode }) {
    const params = {
        ClientId: process.env.USER_POOL_CLIENT_ID,
        Username: username,
        ConfirmationCode: confirmationCode
    };

    try {
        await cognito.confirmSignUp(params).promise();
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            body: JSON.stringify({ message: 'User confirmed successfully' })
        };
    } catch (error) {
        console.error('Confirmation error:', error);
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
}

async function handleRefreshToken({ refreshToken }) {
    const params = {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: process.env.USER_POOL_CLIENT_ID,
        AuthParameters: {
            REFRESH_TOKEN: refreshToken
        }
    };

    try {
        const result = await cognito.initiateAuth(params).promise();
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            body: JSON.stringify({
                accessToken: result.AuthenticationResult.AccessToken,
                idToken: result.AuthenticationResult.IdToken
            })
        };
    } catch (error) {
        console.error('Refresh token error:', error);
        return {
            statusCode: 401,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
    
    async function handleForgotPassword({ username }) {
        const params = {
            ClientId: process.env.USER_POOL_CLIENT_ID,
            Username: username
        };
    
        try {
            await cognito.forgotPassword(params).promise();
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                },
                body: JSON.stringify({
                    message: 'Password reset code sent successfully. Check your email for the code.'
                })
            };
        } catch (error) {
            console.error('Forgot password error:', error);
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                },
                body: JSON.stringify({ error: error.message })
            };
        }
    }
    
    async function handleConfirmForgotPassword({ username, confirmationCode, password }) {
        const params = {
            ClientId: process.env.USER_POOL_CLIENT_ID,
            Username: username,
            ConfirmationCode: confirmationCode,
            Password: password
        };
    
        try {
            await cognito.confirmForgotPassword(params).promise();
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                },
                body: JSON.stringify({ message: 'Password reset successfully' })
            };
        } catch (error) {
            console.error('Confirm forgot password error:', error);
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                },
                body: JSON.stringify({ error: error.message })
            };
        }
    }
    
    async function handleResendVerification({ username }) {
        const params = {
            ClientId: process.env.USER_POOL_CLIENT_ID,
            Username: username
        };
    
        try {
            await cognito.resendConfirmationCode(params).promise();
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                },
                body: JSON.stringify({
                    message: 'Verification code resent successfully. Check your email for the code.'
                })
            };
        } catch (error) {
            console.error('Resend verification error:', error);
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                },
                body: JSON.stringify({ error: error.message })
            };
        }
    }
}
