// Middleware to get raw body for Stripe webhook
export const rawBody = (req, res, next) => {
  req.rawBody = '';
  req.on('data', (chunk) => {
    req.rawBody += chunk;
  });
  req.on('end', () => {
    next();
  });
};