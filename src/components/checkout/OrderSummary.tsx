import { Shield, Lock, Star } from "lucide-react";
import { motion } from "framer-motion";

interface OrderItem {
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  image?: string;
}

interface OrderSummaryProps {
  items: OrderItem[];
  discount?: number;
}

const OrderSummary = ({ items, discount = 0 }: OrderSummaryProps) => {
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const total = subtotal - discount;

  return (
    <div className="bg-checkout-surface text-checkout-surface-foreground rounded-2xl p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-checkout-highlight" />
        <span className="text-sm font-medium text-checkout-muted">Compra 100% Segura</span>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex gap-4"
          >
            {item.image ? (
              <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-checkout-highlight/10 flex items-center justify-center">
                <span className="text-checkout-highlight text-xl font-bold">
                  {item.name.charAt(0)}
                </span>
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-display font-semibold text-sm">{item.name}</h3>
              {item.description && (
                <p className="text-xs text-checkout-muted mt-0.5">{item.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="font-semibold text-checkout-highlight">
                  R$ {item.price.toFixed(2).replace('.', ',')}
                </span>
                {item.originalPrice && (
                  <span className="text-xs text-checkout-muted line-through">
                    R$ {item.originalPrice.toFixed(2).replace('.', ',')}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-checkout-muted">x{item.quantity}</span>
          </motion.div>
        ))}
      </div>

      <div className="border-t border-checkout-muted/20 pt-4 space-y-2">
        <div className="flex justify-between text-sm text-checkout-muted">
          <span>Subtotal</span>
          <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm text-checkout-highlight">
            <span>Desconto</span>
            <span>- R$ {discount.toFixed(2).replace('.', ',')}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-display font-bold pt-2 border-t border-checkout-muted/20">
          <span>Total</span>
          <span className="text-checkout-highlight">R$ {total.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 text-xs text-checkout-muted">
          <Shield className="w-4 h-4 text-checkout-highlight" />
          <span>Garantia de 7 dias ou seu dinheiro de volta</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-checkout-muted">
          <Lock className="w-4 h-4 text-checkout-highlight" />
          <span>Dados criptografados com SSL 256 bits</span>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;
