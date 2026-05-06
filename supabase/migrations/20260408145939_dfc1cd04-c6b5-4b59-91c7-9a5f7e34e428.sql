
UPDATE orders o
SET customer_state = CASE
  WHEN ddd IN ('11','12','13','14','15','16','17','18','19') THEN 'SP'
  WHEN ddd IN ('21','22','24') THEN 'RJ'
  WHEN ddd IN ('27','28') THEN 'ES'
  WHEN ddd IN ('31','32','33','34','35','37','38') THEN 'MG'
  WHEN ddd IN ('41','42','43','44','45','46') THEN 'PR'
  WHEN ddd IN ('47','48','49') THEN 'SC'
  WHEN ddd IN ('51','53','54','55') THEN 'RS'
  WHEN ddd = '61' THEN 'DF'
  WHEN ddd IN ('62','64') THEN 'GO'
  WHEN ddd = '63' THEN 'TO'
  WHEN ddd IN ('65','66') THEN 'MT'
  WHEN ddd = '67' THEN 'MS'
  WHEN ddd = '68' THEN 'AC'
  WHEN ddd = '69' THEN 'RO'
  WHEN ddd IN ('71','73','74','75','77') THEN 'BA'
  WHEN ddd = '79' THEN 'SE'
  WHEN ddd IN ('81','87') THEN 'PE'
  WHEN ddd = '82' THEN 'AL'
  WHEN ddd = '83' THEN 'PB'
  WHEN ddd = '84' THEN 'RN'
  WHEN ddd IN ('85','88') THEN 'CE'
  WHEN ddd IN ('86','89') THEN 'PI'
  WHEN ddd IN ('98','99') THEN 'MA'
  WHEN ddd IN ('91','93','94') THEN 'PA'
  WHEN ddd IN ('92','97') THEN 'AM'
  WHEN ddd = '95' THEN 'RR'
  WHEN ddd = '96' THEN 'AP'
  ELSE NULL
END
FROM (
  SELECT o2.id AS order_id,
         SUBSTRING(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') FROM 1 FOR 2) AS ddd
  FROM orders o2
  JOIN customers c ON c.id = o2.customer_id
  WHERE o2.customer_state IS NULL
    AND c.phone IS NOT NULL
    AND LENGTH(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')) >= 10
) sub
WHERE o.id = sub.order_id;
