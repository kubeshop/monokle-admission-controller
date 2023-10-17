import forge from 'node-forge';

export type CertificateSet = {
  caKey: forge.pki.PrivateKey;
  caCert: forge.pki.Certificate;
  serverKey: forge.pki.PrivateKey;
  serverCert: forge.pki.Certificate;
}

export function generateCertificates(namespace: string, expireInMonths: number): CertificateSet {
  const caKeys = forge.pki.rsa.generateKeyPair(2048);

  const caCert = forge.pki.createCertificate();
  caCert.publicKey = caKeys.publicKey;
  caCert.serialNumber = '01';
  caCert.validity.notBefore = new Date();
  caCert.validity.notAfter = new Date();
  caCert.validity.notAfter.setMonth(caCert.validity.notBefore.getMonth() + expireInMonths);

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
  const serverCert = forge.pki.createCertificate();
  serverCert.publicKey = serverKeys.publicKey;
  serverCert.serialNumber = '01';
  serverCert.validity.notBefore = new Date();
  serverCert.validity.notAfter = new Date();
  serverCert.validity.notAfter.setMonth(serverCert.validity.notBefore.getMonth() + expireInMonths);
  serverCert.setSubject([
    {
        name: 'commonName',
        value: 'monokle-admission-controller-server.monokle-admission-controller.svc',
    },
  ]);
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

export function isCertExpiring(certificate: forge.pki.Certificate, thresholdDays: number): boolean {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + thresholdDays);
    return threshold > certificate.validity.notAfter;
}

export function isCertValid(certificate: forge.pki.Certificate): boolean {
  const now = new Date();
  return now > certificate.validity.notBefore && now < certificate.validity.notAfter;
}
