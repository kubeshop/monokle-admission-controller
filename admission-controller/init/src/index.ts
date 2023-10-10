import fs from 'fs';
import forge from 'node-forge';

const keyDir = process.argv[2];
if (!keyDir) {
    console.error('Missing key directory argument');
    process.exit(1);
}

fs.mkdirSync(keyDir, { mode: 0o700, recursive: true });
process.chdir(keyDir);

const caKeys = forge.pki.rsa.generateKeyPair(2048);

const caCert = forge.pki.createCertificate();
caCert.publicKey = caKeys.publicKey;
caCert.serialNumber = '01';
caCert.validity.notBefore = new Date();
caCert.validity.notAfter = new Date();
caCert.validity.notAfter.setFullYear(caCert.validity.notBefore.getFullYear() + 1);

const attrs = [
    { name: 'commonName', value: 'Monokle Admission Controller CA' },
];
caCert.setSubject(attrs);
caCert.setIssuer(attrs);
caCert.setExtensions([
    {
        name: 'basicConstraints',
        cA: true,
    },
]);

caCert.sign(caKeys.privateKey);

fs.writeFileSync('ca.key', forge.pki.privateKeyToPem(caKeys.privateKey));
fs.writeFileSync('ca.crt', forge.pki.certificateToPem(caCert));

const serverKeys = forge.pki.rsa.generateKeyPair(2048);
const csr = forge.pki.createCertificationRequest();
csr.publicKey = serverKeys.publicKey;
csr.setSubject([
    {
        name: 'commonName',
        value: 'webhook-server.monokle-admission-controller.svc',
    },
]);
// This is according to docs here: https://www.npmjs.com/package/node-forge#pkcs10.
// Looks like some types are incorrect.
(csr as any).setAttributes([
    {
        name: 'extensionRequest',
        extensions: [
            {
                name: 'subjectAltName',
                altNames: [
                    {
                        type: 2,
                        value: 'webhook-server.monokle-admission-controller.svc',
                    },
                ],
            },
        ],
    },
]);
csr.sign(serverKeys.privateKey);

const serverCert = forge.pki.createCertificate();
serverCert.publicKey = csr.publicKey;
serverCert.serialNumber = '01';
serverCert.validity.notBefore = new Date();
serverCert.validity.notAfter = new Date();
serverCert.validity.notAfter.setFullYear(serverCert.validity.notBefore.getFullYear() + 1);
serverCert.setSubject(csr.subject.attributes);
serverCert.setIssuer(caCert.subject.attributes);
serverCert.setExtensions([
    {
        name: 'basicConstraints',
        cA: false,
    },
    {
        name: 'keyUsage',
        nonRepudiation: true,
        digitalSignature: true,
        keyEncipherment: true,
    },
    {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
    },
    {
        name: 'subjectAltName',
        altNames: [
            {
                type: 2,
                value: 'webhook-server.monokle-admission-controller.svc',
            },
        ],
    },
]);
serverCert.sign(caKeys.privateKey, forge.md.sha256.create());

fs.writeFileSync('webhook-server-tls.key', forge.pki.privateKeyToPem(serverKeys.privateKey));
fs.writeFileSync('webhook-server-tls.crt', forge.pki.certificateToPem(serverCert));
