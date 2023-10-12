import forge from 'node-forge';

export type CertificateSet = {
  caKey: forge.pki.PrivateKey;
  caCert: forge.pki.Certificate;
  serverKey: forge.pki.PrivateKey;
  serverCert: forge.pki.Certificate;
}

export function generateCertificates(): CertificateSet {
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

  const serverKeys = forge.pki.rsa.generateKeyPair(2048);
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = serverKeys.publicKey;
  csr.setSubject([
      {
          name: 'commonName',
          value: 'monokle-admission-controller-server.monokle-admission-controller.svc',
      },
  ]);
  // This is according to docs here: https://www.npmjs.com/package/node-forge#pkcs10.
  // Looks like TS typings issue.
  (csr as any).setAttributes([
      {
          name: 'extensionRequest',
          extensions: [
              {
                  name: 'subjectAltName',
                  altNames: [
                      {
                          type: 2,
                          value: 'monokle-admission-controller-server.monokle-admission-controller.svc',
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
                  value: 'monokle-admission-controller-server.monokle-admission-controller.svc',
              },
          ],
      },
  ]);
  serverCert.sign(caKeys.privateKey, forge.md.sha256.create());

  return {
    caKey: caKeys.privateKey,
    caCert: caCert,
    serverKey: serverKeys.privateKey,
    serverCert: serverCert,
  }
}
