mkdir certs

openssl genrsa -out certs/ca.key 2048
openssl req -x509 -new -nodes -key certs/ca.key -days 100000 -out certs/ca.crt -subj "/CN=admission_ca"

echo CA B64 Bundle: $(cat certs/ca.crt | base64 | tr -d '\n')

openssl genrsa -out certs/server.key 2048
openssl req -new -key certs/server.key -out certs/server.csr -subj "/CN=host.docker.internal" -addext "subjectAltName = DNS:host.docker.internal"
openssl x509 -req -in certs/server.csr -CA certs/ca.crt -CAkey certs/ca.key -CAcreateserial -out certs/server.crt -days 100000 -extfile <(echo subjectAltName = DNS:host.docker.internal)

echo Server Key: ../../../scripts/certs/server.key
echo Server Crt: ../../../scripts/certs/server.crt

echo CA Bundle: kubectl patch validatingwebhookconfigurations monokle-admission-controller-webhook --type=json -p=\'[\{\"op\":\"replace\",\"path\":\"/webhooks/0/clientConfig/caBundle\",\"value\":\"$(cat certs/ca.crt | base64 | tr -d '\n')\"\}]\'
