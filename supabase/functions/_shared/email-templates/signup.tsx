/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

const LOGO_URL = 'https://vipltojtcrqatwvzobro.supabase.co/storage/v1/object/public/email-assets/pantera-mascot.png'

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Falta um clique para ativar sua conta — {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="48" height="48" alt={siteName} style={logo} />
        <Heading style={h1}>Bem-vindo à elite digital.</Heading>
        <Text style={text}>
          Sua conta na{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>{' '}
          foi criada com sucesso.
        </Text>
        <Text style={text}>
          Confirme o e-mail{' '}
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>{' '}
          para desbloquear acesso total à plataforma:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Ativar Minha Conta
        </Button>
        <Text style={footer}>
          Não reconhece este cadastro? Ignore este e-mail — nenhuma ação será tomada.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = {
  fontFamily: "'Space Grotesk', 'Inter', Arial, sans-serif",
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#0B0B0D',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#55575d',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: '#00E676', textDecoration: 'underline' }
const button = {
  backgroundColor: '#00E676',
  color: '#000000',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#9B9BA3', margin: '32px 0 0' }
