/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'

interface BroadcastEmailProps {
  siteName: string
  content: string
  subject: string
  unsubscribeUrl: string
}

const LOGO_URL = 'https://vipltojtcrqatwvzobro.supabase.co/storage/v1/object/public/email-assets/pantera-mascot.png'

export const BroadcastEmail = ({
  siteName,
  content,
  subject,
  unsubscribeUrl,
}: BroadcastEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="48" height="48" alt={siteName} style={logo} />
        
        <Section style={contentSection}>
          <Text style={text} dangerouslySetInnerHTML={{ __html: content }} />
        </Section>

        <Hr style={hr} />
        
        <Section style={footerSection}>
          <Text style={footerText}>
            Enviado por {siteName}.
          </Text>
          <Text style={footerText}>
            Se você não deseja mais receber esses e-mails,{' '}
            <Link href={unsubscribeUrl} style={unsubscribeLink}>
              clique aqui para cancelar sua inscrição
            </Link>.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default BroadcastEmail

const main = { backgroundColor: '#f9f9f9', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e0e0e0' }
const logo = { marginBottom: '32px', display: 'block' as const, marginLeft: 'auto', marginRight: 'auto' }
const contentSection = { marginBottom: '32px' }
const text = {
  fontSize: '16px',
  color: '#333333',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const hr = { borderColor: '#eeeeee', margin: '32px 0' }
const footerSection = { textAlign: 'center' as const }
const footerText = { fontSize: '12px', color: '#888888', margin: '4px 0' }
const unsubscribeLink = { color: '#00E676', textDecoration: 'underline' }
