
- Que sea personalizable o configurable utilizar la venta por menor o por mayor , pero si al menos una modalidad 
- Ver precio por curva es a partir de una curva . Precio mayorista es apartir de 50 unidades. 

- Se puede sacar el pago por tarjeta de credito del checkout pro de mercado pago ? 


- referencias para ropa por mayor y por menor para adultos mujeres y hombres https://kandente.com.ar/ y https://www.byninamayorista.com.ar/


                                                                                                                                                        
  necesito que el usuario decida como configuracion si cuando vende por cantidad por mayor tiene un un minimo de compra por ejemplo 50 unidades
  y hacer descuentos al precio a medida que avance la cantidad si por ejemplo vende 
  50 unidades lo vende con un 10%
  100 unidades lo vende con un 20%

 1. ¿Los escalones son globales o por producto? — La propuesta es global (más simple). Si necesitás que cada producto tenga sus propias reglas, la tabla lleva un product_id         
  nullable.                                                                                                                                                                   es por producto y el usuario puede definir si tiene descuentos o no        
  2. ¿El descuento aparece desglosado en el ticket/pedido? — Que el cliente vea "Descuento 10%" o solo ve el precio final.        
  lo puede ver desglosado en el pedido lo veo tanto en el precio final como el descuento que fue aplicado                                                    
  3. ¿Hay descuento por curva también? — La idea menciona solo modalidad cantidad, ¿aplica?  
  Hay descuento por curva , tendria que ser configurable por ejemplo si compra por 10 curvas 




