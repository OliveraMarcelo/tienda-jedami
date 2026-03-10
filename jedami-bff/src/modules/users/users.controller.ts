import { Request, Response } from 'express';
import * as userService from './users.service.js';
export const register = async (req: Request, res: Response)=>{
    try {
        console.log('[Controller] Iniciando registro de usuario');
        const {email, password} = req.body;
        console.log('[Controller] Datos recibidos:', { email });
        const user = await userService.createUser({ email, password }   );
        console.log('[Controller] Usuario creado:', user);
        res.status(201).json(user);
    } catch (error : any) {
        console.error('[Controller] Error al registrar usuario:', error);
        res.status(500).json({ error: 'Error al registrar el usuario' });
    }
} 

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const user = await userService.loginUser(email, password);
        res.status(200).json(user);
    } catch (error : any) {
        res.status(401).json({ error: error.message });
    }
};


export const me = async (req: Request, res: Response) => {
    try {
         res.json({
    user: req.user
  });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los datos del usuario' });
    }
 
};
