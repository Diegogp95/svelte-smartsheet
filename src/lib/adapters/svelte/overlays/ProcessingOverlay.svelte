<script lang="ts">
    export let message: string = "Processing...";
</script>

<!-- Processing overlay that covers the entire table -->
<div 
    class="absolute inset-0 z-40 flex items-center justify-center transition-all duration-500 bg-tertiaryOnBg"
    style="opacity: 0.4"
>
    <!-- Centered content container -->
    <div class="flex flex-col items-center space-y-4 text-tertiaryBg select-none pointer-events-none">
        <!-- Loading spinner -->
        <div class="w-12 h-12 border-4 border-tertiaryBg border-t-transparent rounded-full animate-spin"></div>
        
        <!-- Message text -->
        <div class="text-4xl font-bold font-serif tracking-wide">
            {message}
        </div>
    </div>
</div>