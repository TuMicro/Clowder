import { RequestHandler } from 'express';
import { verifyIdToken } from '../../util/verify-token';

const noValidAuthTokenResponse = {
    status: "AUTH_TKN_ERROR",
}

export function getFirebaseAuthMiddleware(authIsOptional: boolean):
    RequestHandler {
    return function (req, res, next) {
        console.log("arrived on the firebase middleware: " + req.path);
        if (res.locals == null) {
            res.locals = {};
        }

        const authorization = req.header('tkn');
        // l.debug("tkn: " + authorization);
        if (authorization != null && authorization.length > 0) {
            const token = authorization;
            verifyIdToken(token)
                .then((userId) => {
                    if (userId == null) {
                        res.json(noValidAuthTokenResponse);
                    } else {
                        res.locals.userId = userId;
                        next();
                    }
                })
                .catch(err => {
                    console.log(err);
                    res.json(noValidAuthTokenResponse);
                });
        } else {
            if (authIsOptional) {
                next();
            } else {
                console.log('Token in header was not found');
                res.json(noValidAuthTokenResponse);
            }
        }
    };
}
