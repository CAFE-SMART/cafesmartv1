// importa vaalidadores: ISEMAIL--> valida forma de correo
import {IsEmail, IsNotEmpty, MinLength} from 'class-validator';

export class LoginDto {// DTO: Data Transfer Object, es un objeto que se utiliza para transferir datos entre procesos, en este caso, entre el cliente y el servidor.
    @IsEmail()// verifica que el valor sea email valido
    email: string;//verifica que el valoe sea email valido eje pepe@

    @IsNotEmpty()//evita campos vacíos
    @MinLength(6)// exige caracteres mínimo 6
    password: string;
}