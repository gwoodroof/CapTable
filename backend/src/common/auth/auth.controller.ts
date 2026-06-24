import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';

class RegisterDto {
  email!: string;
  password!: string;
  companyName!: string;
}

class LoginDto {
  email!: string;
  password!: string;
}

class GoogleAuthDto {
  credential!: string;
}

class GoogleRegisterDto {
  credential!: string;
  companyName!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const token = await this.authService.register(body.email, body.password, body.companyName);
    return { token };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto) {
    const token = await this.authService.login(body.email, body.password);
    return { token };
  }

  @Post('google')
  @HttpCode(200)
  async googleAuth(@Body() body: GoogleAuthDto) {
    return this.authService.googleAuth(body.credential);
  }

  @Post('google/register')
  async googleRegister(@Body() body: GoogleRegisterDto) {
    const token = await this.authService.googleRegister(body.credential, body.companyName);
    return { token };
  }
}
