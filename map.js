// 當文件加載完成後再初始化地圖
document.addEventListener('DOMContentLoaded', function() {
    console.log('開始初始化地圖...');
    
    // 定義 Excel 檔案路徑
    const xlsxPath = '教育訓練單位總表.xlsx';
    console.log('Excel檔案路徑:', xlsxPath);
    
    // 檢測是否為 iOS 裝置
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
        document.body.classList.add('ios-device');
        console.log('檢測到 iOS 設備，啟用替代選擇器');
    }
    
    // 檢測是否是安卓設備
    const isAndroid = /Android/i.test(navigator.userAgent);
    console.log('是否為安卓設備:', isAndroid);
    
    // 初始化地圖，設置中心點在台灣中心位置
    const map = L.map('map').setView([23.5, 121], 8);

    // 添加OpenStreetMap圖層
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // 從經緯度字串取得座標
    function getCoordinatesFromString(coordString) {
        if (!coordString) {
            console.log('經緯度字串為空');
            return null;
        }
        try {
            // 移除所有引號和多餘的空格
            const cleanString = coordString.replace(/["']/g, '').trim();
            
            // 檢查是否包含經度和緯度
            if (!cleanString.includes(',')) {
                console.log('經緯度字串格式錯誤，缺少逗號分隔符');
                return null;
            }

            // 分割並解析座標
            const parts = cleanString.split(',');
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            
            if (!isNaN(lat) && !isNaN(lng)) {
                return [lat, lng];
            }
            console.log('無效的座標值');
            return null;
        } catch (error) {
            console.error('解析經緯度時發生錯誤:', error);
            return null;
        }
    }

    // 格式化系統帳號
    function formatAccountNumber(account) {
        if (!account) return '無';
        
        try {
            let numStr = String(account).trim();
            
            // 种去非數字字元
            numStr = numStr.replace(/[^\d]/g, '');
            
            if (!numStr) return '無';
            
            // 確保12位數
            if (numStr.length > 12) {
                numStr = numStr.slice(0, 12);
            }
            while (numStr.length < 12) {
                numStr = '0' + numStr;
            }
            
            return numStr;
        } catch (error) {
            console.error('格式化系統帳號時發生錯誤:', error, '原始值:', account);
            return '無法顯示';
        }
    }

    // 建立標記群組，調整群集設定
    const markers = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: true,
        zoomToBoundsOnClick: true,
        spiderfyDistanceMultiplier: 1.5,  // 增加展開時的距離
        animate: false  // 關閉動畫以提高穩定性
    });

    let institutionsData = [];
    let filteredData = [];
    let markerReferences = []; // 定義全域陣列來儲存標記引用

    // 獲取所有選擇器元素
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    const agencySelect = document.getElementById('agency-select');
    const managementSelect = document.getElementById('management