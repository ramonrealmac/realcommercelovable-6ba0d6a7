# Usa o build pré-compilado (dist/) - o projeto usa Bun, não npm
# A pasta dist/ é gerada localmente e empacotada no ZIP de instalação
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]