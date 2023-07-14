cd ~/src/signaling-svc
git pull

echo "Building Server Container..."
docker stop signaling-svc || true
docker rm signaling-svc || true
echo ">>> Running docker build"
echo "${SERVER_IP} is the IP"

docker build \
	--build-arg NODE_ENV=development \
    --build-arg MONGO_SRV=${MONGO_SRV} \
    --build-arg MONGO_HOST=${MONGO_HOST} \
    --build-arg MONGO_USER=${MONGO_USER} \
    --build-arg MONGO_PASS=${MONGO_PASS} \
    --build-arg MONGO_DBNAME=${MONGO_DBNAME} \
    --build-arg TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID} \
    --build-arg TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN} \
    --build-arg SENDGRID_API_KEY=${SENDGRID_API_KEY} \
    --build-arg JWT_SECRET=${JWT_SECRET} \
    --build-arg AWS_ID=${AWS_ID} \
    --build-arg AWS_SECRET=${AWS_SECRET} \
    --build-arg AWS_BUCKET_NAME=${AWS_BUCKET_NAME} \
    --build-arg ALGOLIA_CLIENT=${ALGOLIA_CLIENT} \
    --build-arg ALGOLIA_SECRET=${ALGOLIA_SECRET} \
    --build-arg AWS_VIDEO_BUCKET=${AWS_VIDEO_BUCKET} \
    --build-arg VERSION=${VERSION} \
	--tag signaling-svc \
	.

echo ">>> Building production Image"

docker build \
    --build-arg MONGO_SRV=${MONGO_SRV} \
    --build-arg MONGO_HOST=${MONGO_HOST} \
    --build-arg MONGO_USER=${MONGO_USER} \
    --build-arg MONGO_PASS=${MONGO_PASS} \
    --build-arg MONGO_DBNAME=${MONGO_DBNAME} \
    --build-arg TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID} \
    --build-arg TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN} \
    --build-arg SENDGRID_API_KEY=${SENDGRID_API_KEY} \
    --build-arg JWT_SECRET=${JWT_SECRET} \
    --build-arg AWS_ID=${AWS_ID} \
    --build-arg AWS_SECRET=${AWS_SECRET} \
    --build-arg AWS_BUCKET_NAME=${AWS_BUCKET_NAME} \
    --build-arg ALGOLIA_CLIENT=${ALGOLIA_CLIENT} \
    --build-arg ALGOLIA_SECRET=${ALGOLIA_SECRET} \
    --build-arg AWS_VIDEO_BUCKET=${AWS_VIDEO_BUCKET} \
    --build-arg VERSION=${VERSION} \
	--tag registry.digitalocean.com/icered-services/signaling-svc:${VERSION} \
	.

echo ">>> Image built"
echo "Done. Exiting"
exit