echo "Running Server Container..."
echo ">>> Running Image"
docker network create icered || true

docker run \
	--name=signaling-svc \
	-p 8340:8340/tcp \
	-p 8342:8342/tcp \
	--init \
	--network host \
	-di \
	--rm \
	signaling-svc
docker ps
exit